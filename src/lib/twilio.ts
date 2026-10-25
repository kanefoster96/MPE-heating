import Twilio from "twilio";
import { isSmsOptedOut, SmsOptedOutError } from "@/lib/sms-opt-out";
import { normalizePhone } from "@/lib/phone";

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
export async function sendSms(to: string, body: string) {
  if (await isSmsOptedOut(to)) throw new SmsOptedOutError(to);
  return twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  });
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
