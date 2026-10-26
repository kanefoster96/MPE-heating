import Twilio from "twilio";
import { isSmsOptedOut, SmsOptedOutError } from "@/lib/sms-opt-out";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Only import this from server actions / route handlers that actually send
 * or verify SMS — not from page components — so pages keep rendering
 * before the TWILIO_* env vars are configured (same reasoning as
 * lib/stripe.ts).
 */
// Twilio's client constructor throws immediately if accountSid/username is
// set but doesn't start with "AC"/"SK" — an empty string (not a fake
// placeholder like stripe.ts uses) is what actually skips that check, so
// this stays constructible before real credentials are configured.
//
// Prefers a scoped API Key (SID/Secret) when set — revocable without
// rotating the account's own Auth Token — falling back to the Account SID
// + Auth Token pair otherwise. Either way, TWILIO_AUTH_TOKEN is still
// required separately: verifying an inbound webhook's signature (below)
// only works with the real Account Auth Token, never an API Key secret.
export const twilioClient = process.env.TWILIO_API_KEY_SID
  ? Twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET || "", {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    })
  : Twilio(process.env.TWILIO_ACCOUNT_SID || "", process.env.TWILIO_AUTH_TOKEN || "");

/**
 * Sends one text. Refuses (throws SmsOptedOutError) if the number has
 * replied STOP — every outbound text goes through here, so the opt-out
 * holds whichever code path is sending.
 */
export async function sendSms(to: string, body: string, kind: SmsKind = "manual") {
  if (await isSmsOptedOut(to)) throw new SmsOptedOutError(to);
  const sent = await twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  });
  await createAdminClient()
    .from("sms_sends")
    .insert({ segments: smsSegments(body), kind })
    .then(
      () => undefined,
      () => undefined,
    );
  return sent;
}

/**
 * Texts cost per segment, so they're kept for what can't wait: the one
 * text after someone's first call, and "on my way" (lib/visit-notify.ts).
 * Everything else goes to the app or by email. The automatic ones stop
 * for the month at SMS_MONTHLY_SEGMENTS (default 200, about £12 a month
 * at Twilio's UK price), and the team are told once when it's reached.
 */
export type SmsKind = "call" | "on_my_way" | "late" | "fallback" | "manual";
const MONTHLY_SEGMENTS = Number(process.env.SMS_MONTHLY_SEGMENTS) || 200;

/** How many segments a text is: 160 characters for one, 153 each when it runs to more (70/67 if it isn't plain GSM). */
export function smsSegments(body: string): number {
  const gsm = /^[\x0A\x0D\x20-\x7E£]*$/.test(body);
  const single = gsm ? 160 : 70;
  const part = gsm ? 153 : 67;
  return body.length <= single ? 1 : Math.ceil(body.length / part);
}

/** This month's texts so far (segments), and the limit. */
export async function smsThisMonth(): Promise<{ used: number; limit: number }> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await createAdminClient().from("sms_sends").select("segments").gte("created_at", start.toISOString()).neq("kind", "limit");
  return { used: (data ?? []).reduce((sum, r) => sum + ((r.segments as number) ?? 0), 0), limit: MONTHLY_SEGMENTS };
}

/**
 * Room for an automatic text this month. When there isn't, it goes by the
 * app or email instead, and the team get one push saying so.
 */
export async function smsAllowed(body: string): Promise<boolean> {
  const { used, limit } = await smsThisMonth();
  if (used + smsSegments(body) <= limit) return true;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const admin = createAdminClient();
  const { count } = await admin.from("sms_sends").select("id", { count: "exact", head: true }).eq("kind", "limit").gte("created_at", start.toISOString());
  if (!count) {
    await admin.from("sms_sends").insert({ segments: 0, kind: "limit" });
    const { chatRecipientIds } = await import("@/lib/chat-routing");
    const { pushToUsers } = await import("@/lib/push");
    await pushToUsers(await chatRecipientIds(), {
      title: "Text limit reached",
      body: `This month's ${limit} texts are used. Updates go by the app and email until the 1st. Raise SMS_MONTHLY_SEGMENTS to send more.`,
      data: { kind: "link", href: "/staff" },
    });
  }
  return false;
}

/** Re-exported so callers verifying an inbound webhook don't need their own `import Twilio from "twilio"`. */
export const validateTwilioSignature = Twilio.validateRequest;

/**
 * Best-effort UK phone normalization to E.164 (+44...), since that's what
 * Twilio (and every UK number a parent will actually type) expects:
 * - Already E.164 (starts with "+") — trust it as-is, just strip whitespace.
 * - Domestic "0..." format (07123 456789, 0191 123 4567) — swap the leading
 *   0 for +44.
 * Returns null for anything that doesn't look like a plausible phone number
 * (too short, or containing anything but digits/spaces/a leading +) rather
 * than guessing.
 */
export function normalizeUkPhone(input: string): string | null {
  return normalizePhone(input);
}
