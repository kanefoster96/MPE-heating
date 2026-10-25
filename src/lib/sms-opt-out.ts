import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/contact";
import { CLUB } from "@/lib/club";

/**
 * SMS opt-out handling. Anyone we text can reply STOP to stop all texts
 * from us, HELP for how to reach us, and START to opt back in — the
 * standard keywords carriers and regulators expect a sender to honour.
 * The Twilio webhook (api/webhooks/twilio) recognises them; sendSms
 * (lib/twilio.ts) refuses to text an opted-out number.
 */

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_KEYWORDS = new Set(["start", "unstop", "yes"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

export type SmsKeyword = "stop" | "start" | "help";

/** The whole message must be the keyword (ignoring case, whitespace and trailing punctuation) — "stop" opts out, "please stop texting" is a normal message for a coach. */
export function smsKeywordFor(body: string): SmsKeyword | null {
  const word = body.trim().toLowerCase().replace(/[.!]+$/, "");
  if (STOP_KEYWORDS.has(word)) return "stop";
  if (START_KEYWORDS.has(word)) return "start";
  if (HELP_KEYWORDS.has(word)) return "help";
  return null;
}

export const SMS_HELP_REPLY =
  `${CLUB.name}: for help call ${CONTACT_PHONE} or email ${CONTACT_EMAIL}. Reply STOP to opt out.`;
export const SMS_STOP_REPLY =
  `${CLUB.name}: you've opted out and won't receive any more texts from us. Reply START to opt back in.`;
export const SMS_START_REPLY =
  `${CLUB.name}: you're opted back in to texts from us. Reply STOP at any time to opt out.`;

export class SmsOptedOutError extends Error {
  constructor(phone: string) {
    super(`${phone} has opted out of texts (replied STOP).`);
    this.name = "SmsOptedOutError";
  }
}

export async function isSmsOptedOut(phone: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("sms_opt_outs").select("phone").eq("phone", phone).maybeSingle();
  return !!data;
}

export async function recordSmsOptOut(phone: string, keyword: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("sms_opt_outs")
    .upsert({ phone, keyword, opted_out_at: new Date().toISOString() }, { onConflict: "phone" });
}

export async function clearSmsOptOut(phone: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("sms_opt_outs").delete().eq("phone", phone);
}
