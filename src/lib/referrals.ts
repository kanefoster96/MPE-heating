import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SITE_URL } from "@/lib/club";
import { getCustomer } from "@/lib/customers";
import { getSetting } from "@/lib/settings";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { chatRecipientIds } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";

/**
 * Referrals with something in it for both sides (Kanvas One's trades list,
 * and the Hormozi playbook's "ask at the moment of peak happiness, make it
 * stupid-easy, reward both sides").
 *
 * Every customer has their own link (/r/<code>), in their account and on
 * the thank-you after a good review. Someone who books through it is
 * linked to them (a first-party cookie, mpe_ref, read when the booking
 * form is sent). The new customer gets their reward as money off their
 * first job straight away; the one who recommended them gets theirs once
 * that first job's paid. Rewards are credits: offered as a line on the
 * customer's next invoice (Take payment), used once.
 *
 * The amounts are Fergal's (Settings → Referrals). With neither set,
 * there are no links and nothing's recorded.
 */

export const REF_COOKIE = "mpe_ref";
export const REF_COOKIE_DAYS = 60;
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export type ReferralRewards = { referrerPence: number; friendPence: number };
export type Credit = { id: string; amountPence: number; reason: string; createdAt: string };

function pence(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** The rewards, or null when referrals are off. */
export async function referralRewards(): Promise<ReferralRewards | null> {
  const [a, b] = await Promise.all([getSetting("referral_referrer_pence").catch(() => null), getSetting("referral_friend_pence").catch(() => null)]);
  const rewards = { referrerPence: pence(a), friendPence: pence(b) };
  return rewards.referrerPence || rewards.friendPence ? rewards : null;
}

export function referralLink(code: string): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/r/${code}`;
}

export function isReferralCode(code: string): boolean {
  return /^[a-z2-9]{6}$/.test(code);
}

/** Their code, made the first time it's needed. */
export async function referralCodeFor(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("referral_code").eq("id", customerId).maybeSingle();
  if (data?.referral_code) return data.referral_code as string;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    const { data: set, error } = await admin.from("customers").update({ referral_code: code }).eq("id", customerId).is("referral_code", null).select("referral_code");
    if (!error && set?.length) return code;
    if (!error) {
      // Someone else set it meanwhile: read it back.
      const { data: again } = await admin.from("customers").select("referral_code").eq("id", customerId).maybeSingle();
      if (again?.referral_code) return again.referral_code as string;
    }
  }
  return null;
}

/** Who a code belongs to: their first name, for "Sarah recommends MPE". */
export async function referrerByCode(code: string): Promise<{ id: string; firstName: string | null } | null> {
  if (!isReferralCode(code)) return null;
  const { data } = await createAdminClient().from("customers").select("id, name").eq("referral_code", code).maybeSingle();
  return data ? { id: data.id as string, firstName: (data.name as string | null)?.split(" ")[0] ?? null } : null;
}

async function alertTeam(title: string, body: string, href: string): Promise<void> {
  try {
    await pushToUsers(await chatRecipientIds(), { title, body, data: { kind: "link", href } });
  } catch (err) {
    console.error("referrals: team alert failed", err);
  }
}

const formatPounds = (p: number) => `£${Number.isInteger(p / 100) ? p / 100 : (p / 100).toFixed(2)}`;

/**
 * A booking form came in through someone's link: linked once, and only
 * for someone new (not the referrer themselves, not a customer who's
 * already paid for a job). The new customer's welcome credit is added.
 */
export async function recordReferral(params: { code: string; referredCustomerId: string; enquiryId?: string | null }): Promise<void> {
  const rewards = await referralRewards();
  if (!rewards) return;
  const referrer = await referrerByCode(params.code);
  if (!referrer || referrer.id === params.referredCustomerId) return;
  const admin = createAdminClient();
  const { count: paidBefore } = await admin
    .from("payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", params.referredCustomerId)
    .eq("status", "paid");
  if (paidBefore) return;
  const { data, error } = await admin
    .from("referrals")
    .insert({ referrer_customer_id: referrer.id, referred_customer_id: params.referredCustomerId, enquiry_id: params.enquiryId ?? null })
    .select("id")
    .single();
  if (error || !data) return; // Already referred (unique), or gone.
  if (rewards.friendPence) {
    await admin.from("customer_credits").insert({
      customer_id: params.referredCustomerId,
      amount_pence: rewards.friendPence,
      reason: `Welcome offer: recommended by ${referrer.firstName ?? "a customer"}`,
      referral_id: data.id,
    });
  }
  const friend = await getCustomer(params.referredCustomerId);
  await alertTeam("Referral", `${friend?.name || "A new customer"} booked through ${referrer.firstName ?? "a customer"}'s link.`, `/staff/customers/${params.referredCustomerId}`);
}

/** A customer paid for a job: if they were referred and it's their first, the one who recommended them is rewarded. */
export async function rewardReferralFor(customerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: referral } = await admin
    .from("referrals")
    .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
    .eq("referred_customer_id", customerId)
    .eq("status", "pending")
    .select("id, referrer_customer_id")
    .maybeSingle();
  if (!referral) return;
  const rewards = await referralRewards();
  const [referrer, friend] = await Promise.all([getCustomer(referral.referrer_customer_id as string), getCustomer(customerId)]);
  const friendName = friend?.name?.split(" ")[0] ?? "your friend";
  if (rewards?.referrerPence && referrer) {
    await admin.from("customer_credits").insert({
      customer_id: referrer.id,
      amount_pence: rewards.referrerPence,
      reason: `Thank you for recommending ${friendName}`,
      referral_id: referral.id,
    });
    const body = `${referrer.name ? `Hi ${referrer.name.split(" ")[0]}, ` : "Hi, "}thanks for recommending us to ${friendName}. You've got ${formatPounds(rewards.referrerPence)} off your next job with us: it comes off your next invoice.`;
    await deliverToCustomer(referrer, {
      body,
      headline: "Thanks for recommending us",
      staffId: null,
      pushHref: "/account#refer",
      emailHtml: () =>
        renderEmailLayout({
          previewText: `${formatPounds(rewards.referrerPence)} off your next job`,
          heading: "Thanks for recommending us",
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
          ctaLabel: "Your account",
          ctaUrl: `${CLUB_SITE_URL.replace(/\/$/, "")}/account#refer`,
        }),
    });
  }
  await alertTeam("Referral reward", `${friend?.name || "A referred customer"} paid for their first job${referrer ? `: ${referrer.name || "their referrer"} has ${rewards?.referrerPence ? `${formatPounds(rewards.referrerPence)} off their next job` : "been thanked"}` : ""}.`, `/staff/customers/${referral.referrer_customer_id}`);
}

/** Credits not yet used, for the next invoice. */
export async function availableCredits(customerId: string): Promise<Credit[]> {
  const { data } = await createAdminClient()
    .from("customer_credits")
    .select("id, amount_pence, reason, created_at")
    .eq("customer_id", customerId)
    .is("used_at", null)
    .order("created_at");
  return (data ?? []).map((c) => ({ id: c.id as string, amountPence: c.amount_pence as number, reason: c.reason as string, createdAt: c.created_at as string }));
}

/** Marks credits used on an invoice: only this customer's, only once. */
export async function spendCredits(customerId: string, ids: string[], requestId: string): Promise<void> {
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!clean.length) return;
  await createAdminClient().from("customer_credits").update({ used_at: new Date().toISOString(), used_on_request_id: requestId }).eq("customer_id", customerId).in("id", clean).is("used_at", null);
}

/** For their account: how many they've recommended, and how many have been rewarded. */
export async function referralStats(customerId: string): Promise<{ referred: number; rewarded: number }> {
  const { data } = await createAdminClient().from("referrals").select("status").eq("referrer_customer_id", customerId);
  return { referred: data?.length ?? 0, rewarded: (data ?? []).filter((r) => r.status === "rewarded").length };
}
