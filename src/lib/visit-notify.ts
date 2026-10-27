import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getOrCreateConversationByPhone } from "@/lib/chat-db";
import { replyToForConversation } from "@/lib/chat-notify";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { sendSms, smsAllowed } from "@/lib/twilio";
import { SmsOptedOutError } from "@/lib/sms-opt-out";
import { pushToUsers } from "@/lib/push";
import { CLUB, CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { getAppointment, recordNotice, shiftWindow, type Appointment } from "@/lib/appointments";
import { getCustomer, type Customer } from "@/lib/customers";
import { visitEmailHtml } from "@/lib/emails/visit";
import { noticeBody, noticeHeadline, shortNotice, smsText, type NoticeType } from "@/lib/visit-copy";
import { staffIdentity } from "@/lib/staff-identity";
import { renderEmailLayout } from "@/lib/emails/layout";
import { KIND_LABEL, windowLabel } from "@/lib/day-plan";
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
  /**
   * Whether it goes by text when the app can't reach them: "always" for
   * what can't wait (on my way, running late), "fallback" for a failed
   * monthly payment when there's no email either. Left out: never (the app
   * and email only), which is most messages.
   */
  text?: "always" | "fallback";
  /** A shorter version for the text (one segment, under 160 characters). */
  smsBody?: string;
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

  // 2. The app: free, so it comes first. Someone with the app (notifications
  // on) gets it there instead of a text, which costs per message.
  let inApp = false;
  if (customer.userId) {
    const { count } = await admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", customer.userId);
    inApp = !!count;
    await pushToUsers([customer.userId], { title: d.headline, body: d.body, data: { kind: "link", href: d.pushHref } });
    if (inApp) via.push("app");
  }

  // 3. A text, to a UK mobile, only when the app can't reach them, and only
  // for what can't wait: "on my way" and running late (`text: "always"`).
  // A failed monthly payment (`"fallback"`) is texted only if there's no
  // email either. Everything else: the app and email.
  const wantsText = d.text === "always" || (d.text === "fallback" && !(RESEND_ON && customer.email));
  const smsBody = d.text ? smsText(d.smsBody ?? d.body, CLUB.name, d.smsOptOut) : "";
  if (TWILIO_ON && wantsText && !inApp && customer.phoneE164?.startsWith("+447") && (await smsAllowed())) {
    try {
      await sendSms(customer.phoneE164, smsBody);
      via.push("text");
    } catch (err) {
      if (!(err instanceof SmsOptedOutError)) console.error("deliverToCustomer: text failed", err);
    }
  }

  // 4. Email: always for what they'll want to keep, else only if nothing else reached them.
  if (RESEND_ON && customer.email && (d.email !== "if-no-text" || (!via.includes("text") && !inApp))) {
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
  return (await deliverVisitNotice(appointmentId, type, staffId))?.via ?? [];
}

/**
 * The same, for the team in the app: and when it reached nowhere they'll
 * see it (they've only phoned: no email, no app), the message ready to send
 * from WhatsApp Business instead.
 */
export async function sendVisitNoticeForTeam(appointmentId: string, type: NoticeType, staffId: string): Promise<{ via: string[]; whatsapp: WhatsAppHandoff | null; name: string | null }> {
  const sent = await deliverVisitNotice(appointmentId, type, staffId);
  if (!sent) return { via: [], whatsapp: null, name: null };
  return { via: sent.via, whatsapp: reachedThem(sent.via) ? null : handoffMessage(sent.customer, sent.body), name: sent.customer.name };
}

async function deliverVisitNotice(appointmentId: string, type: NoticeType, staffId: string | null): Promise<{ via: string[]; body: string; customer: Customer } | null> {
  const appointment = await getAppointment(appointmentId);
  const customer = appointment?.customerId ? await getCustomer(appointment.customerId) : null;
  if (!appointment || !customer) return null;

  const link = visitLink(appointment);
  const bookLink = `${CLUB_SITE_URL.replace(/\/$/, "")}/book/service`;
  const engineer = await engineerName(appointment);
  // A call-out's fee, said when it's booked: not for someone on the maintenance plan (theirs are free).
  // (Loaded here, not at the top: payments and the plan reach back into this file.)
  const { CALLOUT_FEE_PENCE, formatPence } = await import("@/lib/payments");
  const { planFor } = await import("@/lib/maintenance-plan");
  const onPlan = appointment.kind === "callout" && type === "booked" ? await planFor(customer.id).then((p) => p?.status === "active" || p?.status === "past_due", () => false) : false;
  const facts = {
    kind: appointment.kind,
    day: appointment.day,
    start: appointment.start,
    end: appointment.end,
    part: appointment.part,
    address: appointment.address ?? customer.address,
    postcode: appointment.postcode ?? customer.postcode,
    calloutFee: appointment.kind === "callout" && !onPlan ? formatPence(CALLOUT_FEE_PENCE) : null,
    planFree: appointment.kind === "callout" && onPlan,
    // A return visit says what it's for: what the first visit said, else its title.
    returning: appointment.followUpOf ? ((await getAppointment(appointment.followUpOf))?.returnNote ?? appointment.title ?? "finish the job") : null,
  };
  // A call-out they can pay ahead, from the booking confirmation (lib/callout-prepay.ts).
  const payLink =
    type === "booked" && facts.calloutFee
      ? await import("@/lib/callout-prepay").then(async ({ canPrepayCallout, prepayLink }) => ((await canPrepayCallout(appointment)) ? prepayLink(appointment) : null)).catch(() => null)
      : null;
  const body = noticeBody(type, facts, { link, bookLink, engineer, phone: business.phoneDisplay, name: customer.name, payLink });

  const via = await deliverToCustomer(customer, {
    body,
    headline: noticeHeadline(type, facts),
    staffId,
    pushHref: type === "service_due" ? "/book/service" : `/visit/${appointment.publicToken}`,
    // Reminders don't need an email as well as a text; confirmations and changes do.
    email: type === "hour" || type === "reminder" ? "if-no-text" : "always",
    smsOptOut: type === "service_due",
    // Texts cost, so they're the same for everyone: running late (and "on my way", sendOnMyWay).
    // A booking, a move or a cancellation for someone with no email or app goes from the
    // team's WhatsApp Business instead (sendVisitNoticeForTeam).
    text: type === "late" ? "always" : undefined,
    smsBody: shortNotice(type, facts, { name: customer.name, engineer, appLink: `${CLUB_SITE_URL.replace(/\/$/, "")}/app` }),
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
        payLink,
      }),
  });

  await recordNotice(appointment.id, type, via);
  return { via, body, customer };
}

/**
 * Whether a message reached them somewhere they'll see it: the app, a text
 * or an email. Their conversation alone doesn't count: someone who's only
 * ever phoned can't see it (no app, not signed in on the website).
 */
export function reachedThem(via: string[]): boolean {
  return via.some((v) => v !== "chat");
}

/** "Open in WhatsApp Business": their number and the message, ready for the team to send by hand. */
export type WhatsAppHandoff = { phone: string; text: string };

/**
 * For a price, an invoice or a receipt that couldn't reach them (no email,
 * no app): the team send it from WhatsApp Business on their phone instead,
 * which costs nothing. The message points at the app, so the next one can
 * go there.
 */
export function whatsappHandoff(customer: Pick<Customer, "name" | "phoneE164">, what: string, link: string): WhatsAppHandoff | null {
  const phone = customer.phoneE164?.replace(/\D/g, "");
  if (!phone) return null;
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  return { phone, text: `${hi}it's ${CLUB.name}. ${what}: ${link}\n\nFor updates on your job and to chat with us, get the ${CLUB.name} app: ${CLUB_SITE_URL.replace(/\/$/, "")}/app` };
}

/** A whole message (a visit's details, say) for WhatsApp Business, with the app at the end. */
export function handoffMessage(customer: Pick<Customer, "phoneE164">, body: string): WhatsAppHandoff | null {
  const phone = customer.phoneE164?.replace(/\D/g, "");
  if (!phone) return null;
  return { phone, text: `${body}\n\nFor updates on your job and to chat with us, get the ${CLUB.name} app: ${CLUB_SITE_URL.replace(/\/$/, "")}/app` };
}

/** What the team's told when it only reached their conversation. */
export function notReachedLine(customer: Pick<Customer, "name">): string {
  const who = customer.name ? customer.name.split(" ")[0] : "They";
  return `Saved, but it hasn't reached ${customer.name ? who : "them"}: no email or the ${CLUB.name} app.`;
}

/** "by message, email and text". */
export function viaPhrase(via: string[]): string {
  const words = via.map((v) => (v === "chat" ? "message" : v === "app" ? "the app" : v));
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
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  const who = engineer ? `your MPE engineer, ${engineer},` : "your MPE engineer";
  const what = appointment.followUpOf ? "your return visit" : appointment.kind === "other" ? "your visit" : `your ${KIND_LABEL[appointment.kind].toLowerCase()}`;
  const arrive = arrivalClock(now, eta);
  const body = `${hi}${who} is on the way for ${what} and should be with you in about ${eta} minutes (around ${arrive}). If you won't be in, let us know: ${visitLink(appointment)}`;
  const via = await deliverToCustomer(customer, {
    body,
    // One of the two texts a customer gets (the other's after their first call).
    text: "always",
    smsBody: `${hi}${engineer ? `${engineer}, your MPE engineer,` : "your MPE engineer"} is on the way. With you around ${arrive}. Reply if anything's changed.`,
    headline: "Your MPE engineer is on the way",
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

/** "Running late" choices: the arrival window moves on by this much. */
export const LATE_MINUTES = [30, 60, 90, 120] as const;

/**
 * Running late: the visit's arrival window moves on (same length), the
 * calendar with it, and the customer's told the new window, with the link
 * to say they won't be in. The window's a safety net, so this is for when
 * even that won't be met.
 */
export async function sendRunningLate(appointmentId: string, staffId: string, minutes: number): Promise<{ via: string[]; window: string } | null> {
  const by = (LATE_MINUTES as readonly number[]).includes(minutes) ? minutes : 60;
  const moved = await shiftWindow(appointmentId, by);
  if (!moved || !moved.customerId) return null;
  const via = await sendVisitNotice(appointmentId, "late", staffId);
  return { via, window: windowLabel(moved.start, moved.end) };
}
