import { createAdminClient } from "@/lib/supabase/admin";
import { londonInstant, londonNow } from "@/lib/schedule-time";
import { getSetting } from "@/lib/settings";

/**
 * MPE's calls and texts allowance: £30 a month (before VAT) of Twilio
 * usage is included in the site's monthly fee from Kanvas One; anything
 * over is added to the next invoice. Every text and call is logged here
 * with what it costs at Twilio's UK list prices, so the month's spend is
 * known as it happens. When the Twilio credentials are set, the sweep also
 * reads Twilio's own total for the month and the higher of the two is
 * used. No alerts: the month's spend is in Settings and the Menu. Calls
 * and texts can be paused once it's used, until the 1st (off by default).
 *
 * Twilio bills in dollars: one fixed rate to pounds (TWILIO_USD_TO_GBP).
 */

export type UsageKind = "text_out" | "text_in" | "call_in" | "call_forward" | "transcription";

/** Twilio's UK list prices, in US dollars before VAT: per text segment, per minute, per month for the number. */
export const RATES_USD: Record<UsageKind | "number", number> = {
  text_out: 0.0463,
  text_in: 0.0075,
  call_in: 0.01,
  call_forward: 0.0305,
  transcription: 0.05,
  number: 2.5,
};

const USD_TO_GBP = Number(process.env.TWILIO_USD_TO_GBP) || 0.79;
/** The month's allowance, in pence before VAT. */
export const ALLOWANCE_PENCE = Number(process.env.TWILIO_ALLOWANCE_PENCE) || 3000;

const pence = (usd: number) => usd * USD_TO_GBP * 100;

/** A text or a call's minutes, logged with its cost. Never throws: a log failing mustn't stop a call or a text. */
export async function logUsage(kind: UsageKind, units: number): Promise<void> {
  if (!(units > 0)) return;
  await createAdminClient()
    .from("twilio_usage")
    .insert({ kind, units, usd: Number((units * RATES_USD[kind]).toFixed(4)) })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Whole minutes, as Twilio bills them (any part of a minute is a minute). */
export function billedMinutes(seconds: number): number {
  return Math.max(1, Math.ceil((Number(seconds) || 0) / 60));
}

/** This month in London ("2026-10"): the allowance resets at midnight on the 1st, UK time. */
function londonMonth(): string {
  return londonNow().dateISO.slice(0, 7);
}

function monthStart(): Date {
  return londonInstant(`${londonMonth()}-01`, 0);
}

export type MonthUsage = {
  month: string;
  /** Texts sent and received, minutes in and put through, voicemail minutes transcribed: count and pence. */
  parts: { kind: UsageKind; label: string; units: number; unit: string; pence: number }[];
  numberPence: number;
  /** Our running total, Twilio's own (when it can be read), and the one used: the higher. */
  estimatePence: number;
  twilioPence: number | null;
  spentPence: number;
  allowancePence: number;
  overPence: number;
  /** At this month's pace so far: the month's total, and what's likely to be over by the end. */
  projectedPence: number;
  projectedOverPence: number;
  /** After the allowance, texts and calls pause until the 1st (Settings). */
  pauseWhenUsed: boolean;
  paused: boolean;
};

const LABEL: Record<UsageKind, { label: string; unit: string }> = {
  text_out: { label: "Texts sent", unit: "segments" },
  text_in: { label: "Texts received", unit: "texts" },
  call_in: { label: "Calls in", unit: "minutes" },
  call_forward: { label: "Calls put through to you", unit: "minutes" },
  transcription: { label: "Voicemails written out", unit: "minutes" },
};

/** Every usage row since `start`, a page at a time: a busy month runs past the database's 1,000-row reply. */
async function usageRowsSince(start: Date): Promise<{ kind: UsageKind; units: number; usd: number }[]> {
  const admin = createAdminClient();
  const all: { kind: UsageKind; units: number; usd: number }[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await admin.from("twilio_usage").select("kind, units, usd").gte("created_at", start.toISOString()).order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as { kind: UsageKind; units: number; usd: number }[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export async function monthUsage(): Promise<MonthUsage> {
  const admin = createAdminClient();
  const start = monthStart();
  const [rows, { data: month }, pause] = await Promise.all([
    usageRowsSince(start),
    admin.from("twilio_months").select("twilio_usd").eq("month", londonMonth()).maybeSingle(),
    getSetting("twilio_pause_when_used").catch(() => null),
  ]);
  const totals = new Map<UsageKind, { units: number; usd: number }>();
  for (const r of rows) {
    const t = totals.get(r.kind) ?? { units: 0, usd: 0 };
    totals.set(r.kind, { units: t.units + Number(r.units), usd: t.usd + Number(r.usd) });
  }
  const parts = (Object.keys(LABEL) as UsageKind[]).map((kind) => ({
    kind,
    label: LABEL[kind].label,
    unit: LABEL[kind].unit,
    units: totals.get(kind)?.units ?? 0,
    pence: Math.round(pence(totals.get(kind)?.usd ?? 0)),
  }));
  const numberPence = Math.round(pence(RATES_USD.number));
  const estimatePence = parts.reduce((sum, p) => sum + p.pence, 0) + numberPence;
  const twilioPence = month?.twilio_usd != null ? Math.round(pence(Number(month.twilio_usd))) : null;
  const spentPence = Math.max(estimatePence, twilioPence ?? 0);

  const now = new Date();
  const day = now.getUTCDate();
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // The number's fee is the same whatever the month brings; the rest goes at this month's pace (once there's a few days of it).
  const variable = spentPence - numberPence;
  const projectedPence = day >= 3 ? Math.round(numberPence + (variable / day) * days) : spentPence;
  const pauseWhenUsed = pause === "1";
  return {
    month: londonMonth(),
    parts,
    numberPence,
    estimatePence,
    twilioPence,
    spentPence,
    allowancePence: ALLOWANCE_PENCE,
    overPence: Math.max(0, spentPence - ALLOWANCE_PENCE),
    projectedPence: Math.max(projectedPence, spentPence),
    projectedOverPence: Math.max(0, Math.max(projectedPence, spentPence) - ALLOWANCE_PENCE),
    pauseWhenUsed,
    paused: pauseWhenUsed && spentPence >= ALLOWANCE_PENCE,
  };
}

/** Whether texts and calls are paused for the rest of the month (the allowance is used, and Settings says pause). */
export async function usagePaused(): Promise<boolean> {
  return (await monthUsage().catch(() => null))?.paused ?? false;
}

/** Each kind's price in pence, for Settings (and the terms Kanvas One gives MPE). */
export function ratesInPence(): { label: string; price: string }[] {
  const p = (usd: number) => `${(pence(usd)).toFixed(1)}p`;
  return [
    { label: "Text sent (per 160 characters)", price: p(RATES_USD.text_out) },
    { label: "Text received", price: p(RATES_USD.text_in) },
    { label: "Call in, per minute", price: p(RATES_USD.call_in) },
    { label: "Call put through to your phone, per minute (on top of the call in)", price: p(RATES_USD.call_forward) },
    { label: "Call out from the MPE number, per minute (your phone and theirs)", price: p(RATES_USD.call_forward * 2) },
    { label: "Voicemail written out, per minute", price: p(RATES_USD.transcription) },
    { label: "The MPE number, per month", price: `£${(pence(RATES_USD.number) / 100).toFixed(2)}` },
  ];
}

export function poundsFromPence(p: number): string {
  return `£${(p / 100).toFixed(2)}`;
}

/** Twilio's own total for the month (dollars), when the credentials are set: read by the sweep every half an hour. */
export async function syncTwilioTotal(): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID || !(process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_KEY_SECRET)) return;
  const admin = createAdminClient();
  const month = londonMonth();
  const { data: row } = await admin.from("twilio_months").select("checked_at").eq("month", month).maybeSingle();
  if (row?.checked_at && Date.now() - new Date(row.checked_at as string).getTime() < 30 * 60_000) return;
  try {
    const { twilioClient } = await import("@/lib/twilio");
    const [total] = await twilioClient.usage.records.thisMonth.list({ category: "totalprice", limit: 1 });
    const usd = total ? Number(total.price) : null;
    await admin.from("twilio_months").upsert({ month, twilio_usd: usd, checked_at: new Date().toISOString() }, { onConflict: "month" });
  } catch (err) {
    console.error("twilio usage: couldn't read Twilio's total", err);
    await admin.from("twilio_months").upsert({ month, checked_at: new Date().toISOString() }, { onConflict: "month" });
  }
}
