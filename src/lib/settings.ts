import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple settings the team changes in Settings (app_settings). Read
 * server-side only.
 */
export type SettingKey = "review_url" | "plan_month_pence" | "plan_year_pence" | "plan_min_months" | "referral_referrer_pence" | "referral_friend_pence" | "report_sent_for" | "twilio_pause_when_used" | "waiting_reminder_for";

export async function getSetting(key: SettingKey): Promise<string | null> {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as string | null) ?? null;
}

export async function setSetting(key: SettingKey, value: string | null): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  return !error;
}

/**
 * Where customers post a public review: MPE's Google Business Profile review
 * link, set in Settings (Google Business Profile → Ask for reviews → copy
 * the link, e.g. https://g.page/r/…/review). Null until it's set, and then
 * the review page just doesn't offer it.
 */
export async function reviewUrl(): Promise<string | null> {
  const url = await getSetting("review_url").catch(() => null);
  return url && /^https:\/\//.test(url) ? url : null;
}

/** A Google review link as pasted: https only, and only from Google's own domains. */
export function parseReviewUrl(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, url: null };
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const google = host === "g.page" || host === "maps.app.goo.gl" || host === "goo.gl" || /(^|\.)google\.[a-z.]+$/.test(host) || host === "search.google.com";
    if (url.protocol !== "https:" || !google) return { ok: false, error: "Paste the review link from your Google Business Profile (it starts https://g.page/r/…)." };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
}
