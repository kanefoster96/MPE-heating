// Ported from Kanvas Academy (src/lib/coach-calls.ts): calling a customer
// back from the business number, and working out who a phone number is.
// "Coach" is the Academy's word for a member of staff; here, an engineer.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { staffIdentity } from "@/lib/staff-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { twilioClient } from "@/lib/twilio";
import { CLUB } from "@/lib/club";
import { business } from "@/lib/content";
import { formatPhone } from "@/lib/phone";
import { usagePaused } from "@/lib/twilio-usage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

/**
 * Calling a customer back from the business number. The engineer's own phone
 * rings first (from the MPE number); when they answer, Twilio dials the
 * customer with the MPE number as caller ID — so customers only ever see
 * the business number, never an engineer's personal one.
 */

export class CoachPhoneMissingError extends Error {
  constructor() {
    super("Add your mobile number first — it's the phone we ring to connect you.");
  }
}

/** UK numbers only, and none of the premium/special ranges — this dials out on the academy's account. */
export function callableUkNumber(input: string | null | undefined): string | null {
  const phone = input ? normalizePhone(input) : null;
  if (!phone) return null;
  return /^\+44(7\d{9}|[123]\d{9})$/.test(phone) ? phone : null;
}

export function coachPhoneOf(user: User | null | undefined): string | null {
  const phone = user?.user_metadata?.phone;
  return callableUkNumber(typeof phone === "string" ? phone : null);
}

/**
 * The phone a call from the MPE number rings first: their own mobile if
 * they've saved one, else Fergal's, so no one's asked for a number before
 * their first call.
 */
export function ringPhoneOf(user: User | null | undefined): string | null {
  return coachPhoneOf(user) ?? callableUkNumber(business.engineerMobile);
}

/** Whether calls can go out from the MPE number: Twilio's set up, with a number. */
/**
 * Calls out from the Twilio number, once it's set up. They come out of the
 * month's calls and texts allowance (lib/twilio-usage.ts), and stop while
 * calls and texts are paused. OUTBOUND_CALLS_ON=0 switches them off.
 */
export function businessCallsOn(): boolean {
  return process.env.OUTBOUND_CALLS_ON !== "0" && !!(process.env.TWILIO_PHONE_NUMBER && (process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_KEY_SECRET));
}

/** For the app's Call sheet: whether it's on (and not paused), the number customers see, and the phone that rings first. */
export async function callSetup(user: User) {
  const ring = ringPhoneOf(user);
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER ?? null;
  return {
    on: businessCallsOn(),
    paused: businessCallsOn() && (await usagePaused()),
    businessNumber: twilioNumber ? formatPhone(twilioNumber) : null,
    ringPhone: ring ? formatPhone(ring) : null,
    ownPhone: !!coachPhoneOf(user),
  };
}

/** Saves the coach's own mobile (user_metadata.phone, same place contact details keep it). */
export async function saveCoachPhone(userId: string, input: string): Promise<string | null> {
  const phone = callableUkNumber(input);
  if (!phone || !phone.startsWith("+447")) return null;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = data?.user?.user_metadata ?? {};
  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, phone } });
  return error ? null : phone;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Rings the coach, then connects them to `to`. Logs it in the family's chat
 * when there is one, so everyone can see they've been called back.
 */
export async function startBridgedCall(params: { coach: User; to: string; conversationId?: string | null }): Promise<void> {
  const coachPhone = ringPhoneOf(params.coach);
  if (!coachPhone) throw new CoachPhoneMissingError();
  const businessNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!businessNumber) throw new Error("The business number isn't set up yet.");

  const twiml =
    `<Response><Say voice="Polly.Amy-Neural" language="en-GB">${escapeXml(CLUB.name)}. Connecting your call.</Say>` +
    `<Dial callerId="${escapeXml(businessNumber)}" timeout="30" action="${(await import("@/lib/missed-calls")).callbackUrl("/after", params.conversationId ?? null, params.to, { out: "1" })}">${escapeXml(params.to)}</Dial></Response>`;

  // Short ring on the coach's side, so an unanswered call gives up before
  // their own voicemail picks up and gets connected to the family.
  await twilioClient.calls.create({ to: coachPhone, from: businessNumber, twiml, timeout: 18 });

  if (params.conversationId) {
    const admin = createAdminClient();
    await admin.from("chat_messages").insert({
      conversation_id: params.conversationId,
      sender_id: params.coach.id,
      sender_is_coach: true,
      channel: "sms",
      body: `${(await staffIdentity(params.coach)).name} called you from the ${CLUB.shortName} number`,
    });
    // A coach's own call, so read as well, as a coach's reply is (lib/coach-send.ts).
    const now = new Date().toISOString();
    await admin.from("chat_conversations").update({ last_message_at: now, coach_last_read_at: now }).eq("id", params.conversationId);
    // A call back is a reply: their new bookings are contacted, so the nudges stop.
    await admin.from("enquiries").update({ status: "contacted", updated_at: now, updated_by: params.coach.id }).eq("conversation_id", params.conversationId).eq("status", "new");
  }
}

/**
 * Who a phone number belongs to, for the name at the top of a text or
 * missed-call conversation: the customer who last sent a booking form with
 * it. Null for a number we don't know.
 */
export async function identifyPhone(admin: Db, phone: string): Promise<{ name: string; email: string | null } | null> {
  const { data } = await admin
    .from("enquiries")
    .select("name, email")
    .eq("phone_e164", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const name = (data.name as string | null)?.trim() || (data.email as string | null) || null;
  return name ? { name, email: (data.email as string | null) ?? null } : null;
}
