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
import { noticeBody, noticeHeadline, smsText, type NoticeType } from "@/lib/visit-copy";
import { staffIdentity } from "@/lib/staff-identity";
import { renderEmailLayout } from "@/lib/emails/layout";
import { KIND_LABEL } from "@/lib/day-plan";
import { formatLondonClock } from "@/lib/schedule-time";

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

export type Delivery = {
  /** The message: the chat message, the email's plain text and the text (made plain). */
  body: string;
  headline: string;
  emailHtml: (canReplyByEmail: boolean) => string;
  /** Where the app opens when the notification is tapped. */
  pushHref: string;
  /** The member of staff it's from; none for automatic messages. */
  staffId: string | null;
  /** "if-no-text": the hour-before message, where an email would arrive too late to matter. */
  email?: "always" | "if-no-text";
  /** Adds "Reply STOP to opt out." to the text: for anything not about a booked visit. */
  smsOptOut?: boolean;
  /** A payment request: the chat shows it as a Pay card (lib/payments.ts). */
  paymentRequestId?: string;
};

/**
 * Sends one message to a customer every way we can reach them, and says
 * which worked: their conversation (the record, and where replies land),
 * a text to a UK mobile, an email, and the app.
 */
export async function deliverToCustomer(customer: Customer, d: Delivery): Promise<string[]> {
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
        sender_id: d.staffId,
        sender_is_coach: true,
        body: d.body,
        ...(d.paymentRequestId ? { payment_request_id: d.paymentRequestId } : {}),
      });
      if (!error) {
        via.push("chat");
        await admin
          .from("chat_conversations")
          // Read only when a person sent it: an automatic message mustn't hide a customer's unanswered one.
          .update({ last_message_at: now, completed_at: null, completed_by: null, ...(d.staffId ? { coach_last_read_at: now } : {}) })
          .eq("id", conversationId);
      }
    }
  } catch (err) {
    console.error("deliverToCustomer: chat failed", err);
  }

  // 2. Text, to a UK mobile.
  if (TWILIO_ON && customer.phoneE164?.startsWith("+447")) {
    try {
      await sendSms(customer.phoneE164, smsText(d.body, CLUB.name, d.smsOptOut));
      via.push("text");
    } catch (err) {
      if (!(err instanceof SmsOptedOutError)) console.error("deliverToCustomer: text failed", err);
    }
  }

  // 3. Email.
  if (RESEND_ON && customer.email && (d.email !== "if-no-text" || !via.includes("text"))) {
    try {
      const replyTo = conversationId ? await replyToForConversation(conversationId) : null;
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: customer.email,
        ...(replyTo ? { replyTo } : {}),
        subject: `${d.headline} — ${CLUB.name}`,
        text: d.body,
        html: d.emailHtml(!!replyTo),
      });
      if (!error) via.push("email");
      else console.error("deliverToCustomer: email failed", error);
    } catch (err) {
      console.error("deliverToCustomer: email failed", err);
    }
  }

  // 4. The app.
  if (customer.userId) {
    await pushToUsers([customer.userId], { title: d.headline, body: d.body, data: { kind: "link", href: d.pushHref } });
  }
  return via;
}

/** The engineer's first name for "Fergal from MPE will be with you": the one assigned, else whoever booked it. */
async function engineerName(appointment: Appointment): Promise<string | null> {
  const id = appointment.engineerId ?? appointment.createdBy;
  if (!id) return null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(id);
    const name = data?.user ? (await staffIdentity(data.user)).name : "";
    const first = name.split(" ")[0]?.replace(/[^A-Za-z'-]/g, "");
    return first && !name.includes("@") ? first : null;
  } catch {
    return null;
  }
}

export async function sendVisitNotice(
  appointmentId: string,
  type: NoticeType,
  /** The member of staff sending it; none for automatic messages. */
  staffId: string | null,
): Promise<string[]> {
  const appointment = await getAppointment(appointmentId);
  const customer = appointment?.customerId ? await getCustomer(appointment.customerId) : null;
  if (!appointment || !customer) return [];

  const link = visitLink(appointment);
  const bookLink = `${CLUB_SITE_URL.replace(/\/$/, "")}/book/service`;
  const engineer = type === "hour" ? await engineerName(appointment) : null;
  const facts = {
    kind: appointment.kind,
    day: appointment.day,
    start: appointment.start,
    end: appointment.end,
    part: appointment.part,
    address: appointment.address ?? customer.address,
    postcode: appointment.postcode ?? customer.postcode,
    // A return visit says what it's for: what the first visit said, else its title.
    returning: appointment.followUpOf ? ((await getAppointment(appointment.followUpOf))?.returnNote ?? appointment.title ?? "finish the job") : null,
  };
  const body = noticeBody(type, facts, { link, bookLink, engineer, phone: business.phoneDisplay, name: customer.name });

  const via = await deliverToCustomer(customer, {
    body,
    headline: noticeHeadline(type, facts),
    staffId,
    pushHref: type === "service_due" ? "/book/service" : `/visit/${appointment.publicToken}`,
    // Reminders don't need an email as well as a text; confirmations and changes do.
    email: type === "hour" || type === "reminder" ? "if-no-text" : "always",
    smsOptOut: type === "service_due",
    emailHtml: (canReplyByEmail) =>
      visitEmailHtml({
        type,
        visit: facts,
        name: customer.name,
        link,
        bookLink,
        engineer,
        phone: business.phoneDisplay,
        phoneHref: business.phoneHref,
        canReplyByEmail,
      }),
  });

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

/** "On my way" ETAs the visit card offers, in minutes. */
export const ON_MY_WAY_ETAS = [15, 30, 45, 60, 90] as const;

/** "9:45am": the time they should arrive, to the nearest five minutes. */
export function arrivalClock(fromIso: string, etaMinutes: number): string {
  const at = new Date(Math.round((new Date(fromIso).getTime() + etaMinutes * 60_000) / 300_000) * 300_000);
  const [h, m] = formatLondonClock(at).split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/**
 * "On my way": one tap on the visit card when the engineer sets off. The
 * customer gets a text (an email only if there's no text, it'd arrive too
 * late to matter), a message in their chat and the app: who's coming, and
 * roughly when.
 */
export async function sendOnMyWay(appointmentId: string, staffId: string, etaMinutes: number): Promise<string[]> {
  const appointment = await getAppointment(appointmentId);
  const customer = appointment?.customerId ? await getCustomer(appointment.customerId) : null;
  if (!appointment || !customer || appointment.status !== "booked") return [];
  const eta = (ON_MY_WAY_ETAS as readonly number[]).includes(etaMinutes) ? etaMinutes : 30;
  const now = new Date().toISOString();
  let engineer: string | null = null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(staffId);
    const name = data?.user ? (await staffIdentity(data.user)).name : "";
    const first = name.split(" ")[0]?.replace(/[^A-Za-z'-]/g, "");
    engineer = first && !name.includes("@") ? first : null;
  } catch {
    engineer = null;
  }
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "";
  const who = engineer ? `${engineer} from MPE` : hi ? "your MPE engineer" : "Your MPE engineer";
  const what = appointment.followUpOf ? "your return visit" : appointment.kind === "other" ? "your visit" : `your ${KIND_LABEL[appointment.kind].toLowerCase()}`;
  const arrive = arrivalClock(now, eta);
  const body = `${hi}${who} is on the way for ${what} and should be with you in about ${eta} minutes (around ${arrive}). If anything's changed, call ${business.phoneDisplay}.`;
  const via = await deliverToCustomer(customer, {
    body,
    headline: engineer ? `${engineer} is on the way` : "We're on the way",
    staffId,
    pushHref: `/visit/${appointment.publicToken}`,
    email: "if-no-text",
    emailHtml: () =>
      renderEmailLayout({
        previewText: `With you around ${arrive}`,
        heading: "On the way",
        bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
        ctaLabel: "See your visit",
        ctaUrl: visitLink(appointment),
      }),
  });
  await createAdminClient().from("appointments").update({ on_my_way_at: now, on_my_way_eta: eta }).eq("id", appointment.id);
  return via;
}
