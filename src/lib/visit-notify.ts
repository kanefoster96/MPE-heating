import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getOrCreateConversationByPhone } from "@/lib/chat-db";
import { replyToForConversation } from "@/lib/chat-notify";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";
import { SmsOptedOutError } from "@/lib/sms-opt-out";
import { pushToUsers } from "@/lib/push";
import { CLUB, CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { getAppointment, recordNotice, type Appointment } from "@/lib/appointments";
import { getCustomer, type Customer } from "@/lib/customers";
import { visitEmailHtml } from "@/lib/emails/visit";
import { noticeBody, noticeHeadline, type NoticeType } from "@/lib/visit-copy";

/**
 * Letting a customer know about their visit: booked, moved, cancelled, the
 * day-before reminder, or that their request is in. One call sends it every
 * way we can reach them, so the team never has to think about how:
 *
 * - a message in their conversation, so the inbox has the record and a
 *   reply lands in the same thread;
 * - an email, if we have their address (replies come back to the chat once
 *   CHAT_REPLY_DOMAIN is set);
 * - a text, if we have a UK mobile and Twilio is set up;
 * - a push, if they have the MPE app.
 *
 * Each is best effort: one failing never stops the others. Returns how it
 * went, e.g. ["chat", "email", "text"], for the team's "sent by" line.
 */

const TWILIO_ON = !!(process.env.TWILIO_PHONE_NUMBER && (process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_KEY_SECRET));
const RESEND_ON = !!process.env.RESEND_API_KEY;

/** The customer's page for this visit. */
export function visitLink(a: Pick<Appointment, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/visit/${a.publicToken}`;
}

/** The customer's conversation: theirs, else one by mobile or login (and remembered). */
async function conversationFor(customer: Customer): Promise<string | null> {
  if (customer.conversationId) return customer.conversationId;
  const conversation = customer.phoneE164
    ? await getOrCreateConversationByPhone(customer.phoneE164, customer.name)
    : customer.userId
      ? await getOrCreateConversation(customer.userId, customer.name ?? undefined)
      : null;
  if (!conversation) return null;
  await createAdminClient().from("customers").update({ conversation_id: conversation.id }).eq("id", customer.id);
  return conversation.id;
}

export async function sendVisitNotice(
  appointmentId: string,
  type: NoticeType,
  /** The member of staff sending it; none for the automatic reminder. */
  staffId: string | null,
): Promise<string[]> {
  const appointment = await getAppointment(appointmentId);
  const customer = appointment?.customerId ? await getCustomer(appointment.customerId) : null;
  if (!appointment || !customer) return [];

  const link = visitLink(appointment);
  const facts = {
    kind: appointment.kind,
    day: appointment.day,
    start: appointment.start,
    end: appointment.end,
    part: appointment.part,
    address: appointment.address ?? customer.address,
    postcode: appointment.postcode ?? customer.postcode,
  };
  const body = noticeBody(type, facts, { link, phone: business.phoneDisplay, name: customer.name });
  const via: string[] = [];
  const admin = createAdminClient();

  // 1. The conversation.
  let conversationId: string | null = null;
  try {
    conversationId = await conversationFor(customer);
    if (conversationId) {
      const now = new Date().toISOString();
      const { error } = await admin.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: staffId,
        sender_is_coach: true,
        body,
      });
      if (!error) {
        via.push("chat");
        await admin
          .from("chat_conversations")
          .update({ last_message_at: now, completed_at: null, completed_by: null, coach_last_read_at: now })
          .eq("id", conversationId);
      }
    }
  } catch (err) {
    console.error("sendVisitNotice: chat failed", err);
  }

  // 2. Email.
  if (RESEND_ON && customer.email) {
    try {
      const replyTo = conversationId ? await replyToForConversation(conversationId) : null;
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: customer.email,
        ...(replyTo ? { replyTo } : {}),
        subject: `${noticeHeadline(type, facts)} — ${CLUB.name}`,
        text: body,
        html: visitEmailHtml({
          type,
          visit: facts,
          name: customer.name,
          link,
          phone: business.phoneDisplay,
          phoneHref: business.phoneHref,
          canReplyByEmail: !!replyTo,
        }),
      });
      if (!error) via.push("email");
      else console.error("sendVisitNotice: email failed", error);
    } catch (err) {
      console.error("sendVisitNotice: email failed", err);
    }
  }

  // 3. Text, to a UK mobile.
  if (TWILIO_ON && customer.phoneE164?.startsWith("+447")) {
    try {
      await sendSms(customer.phoneE164, `${CLUB.name}: ${body}`);
      via.push("text");
    } catch (err) {
      if (!(err instanceof SmsOptedOutError)) console.error("sendVisitNotice: text failed", err);
    }
  }

  // 4. The app.
  if (customer.userId) {
    await pushToUsers([customer.userId], {
      title: noticeHeadline(type, facts),
      body,
      data: { kind: "link", href: `/visit/${appointment.publicToken}` },
    });
  }

  await recordNotice(appointment.id, type, via);
  return via;
}

/** "by message, email and text". */
export function viaPhrase(via: string[]): string {
  const words = via.map((v) => (v === "chat" ? "message" : v));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * A customer wrote about a visit (asked for one, or asked to move it): it
 * goes in their conversation as their own message, and every admin and
 * engineer gets a push, like any other message from a customer.
 */
export async function postCustomerVisitMessage(customer: Customer, body: string): Promise<void> {
  try {
    const conversationId = await conversationFor(customer);
    if (!conversationId) return;
    const admin = createAdminClient();
    const { data: convo } = await admin.from("chat_conversations").select("user_id").eq("id", conversationId).maybeSingle();
    await admin.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: (convo?.user_id as string | null) ?? null,
      sender_is_coach: false,
      body,
    });
    await admin
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), completed_at: null, completed_by: null })
      .eq("id", conversationId);
    await notifyStaffOfFamilyMessage({ conversationId, fromName: customer.name || customer.email || "Customer", body });
  } catch (err) {
    console.error("postCustomerVisitMessage failed", err);
  }
}
