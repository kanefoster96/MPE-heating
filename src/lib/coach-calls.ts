// Ported from Kanvas Academy (src/lib/coach-calls.ts): calling a customer
// back from the business number, and working out who a phone number is.
// "Coach" is the Academy's word for a member of staff; here, an engineer.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { staffIdentity } from "@/lib/staff-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { twilioClient } from "@/lib/twilio";
import { CLUB } from "@/lib/club";

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
  const coachPhone = coachPhoneOf(params.coach);
  if (!coachPhone) throw new CoachPhoneMissingError();
  const businessNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!businessNumber) throw new Error("The business number isn't set up yet.");

  const twiml =
    `<Response><Say voice="Polly.Amy-Neural" language="en-GB">${escapeXml(CLUB.name)}. Connecting your call.</Say>` +
    `<Dial callerId="${escapeXml(businessNumber)}" timeout="30">${escapeXml(params.to)}</Dial></Response>`;

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
      body: `${(await staffIdentity(params.coach)).name} called from the ${CLUB.shortName} number`,
    });
    // A coach's own call, so read as well, as a coach's reply is (lib/coach-send.ts).
    const now = new Date().toISOString();
    await admin.from("chat_conversations").update({ last_message_at: now, coach_last_read_at: now }).eq("id", params.conversationId);
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
