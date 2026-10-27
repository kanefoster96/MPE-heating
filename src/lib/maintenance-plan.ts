import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, subscriptionFee } from "@/lib/stripe";
import { CLUB_SITE_URL } from "@/lib/club";
import { business, homeExtras } from "@/lib/content";
import { chatRecipientIds } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";
import { getCustomer, type Customer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { getSetting } from "@/lib/settings";
import { formatPence, paymentsOn, stripeCustomerFor } from "@/lib/payments";
import { addMonths } from "@/lib/instalment-schedule";

/**
 * The maintenance plan: Kanvas Academy's memberships, for MPE. What it
 * includes is what the site already says (free call-outs all year round
 * and a free yearly service); the prices, monthly and/or yearly, and any
 * minimum term are Fergal's, set in Settings. No price, no plan to join:
 * the site's plan form still takes enquiries.
 *
 * Joining: Fergal sends the customer their link from their page, or they
 * open it from their account. They pick monthly or yearly and pay by
 * Stripe Checkout; it's a Stripe subscription from then on. The webhook
 * keeps the row in step (paid, failed, ending, ended).
 *
 * Managing: from their account they can update their card and see their
 * payments (Stripe's billing page), or cancel, which takes effect at the
 * end of what they've paid for, or at the end of the minimum term if
 * there is one. The team can do the same from the customer's page.
 */

export type PlanBilling = "month" | "year";
export type PlanStatus = "pending" | "active" | "past_due" | "ended";
export type PlanPrices = { monthPence: number | null; yearPence: number | null; minMonths: number };

/** What the plan includes: the site's own words (lib/content.ts), never more. */
export const PLAN_BENEFITS: string[] = homeExtras.plan.points.filter((p) => !/^For /.test(p));
export const PLAN_NAME = "Maintenance plan";
export const BILLING_LABEL: Record<PlanBilling, string> = { month: "a month", year: "a year" };

export type PlanMember = {
  id: string;
  customerId: string;
  status: PlanStatus;
  billing: PlanBilling | null;
  pricePence: number | null;
  minMonths: number;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastServiceOn: string | null;
  paymentFailedAt: string | null;
  publicToken: string;
  createdAt: string;
};

type Row = {
  id: string;
  customer_id: string;
  status: PlanStatus;
  billing: PlanBilling | null;
  price_pence: number | null;
  min_months: number | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  last_service_on: string | null;
  payment_failed_at: string | null;
  public_token: string;
  created_at: string;
};

function mapRow(r: Row): PlanMember {
  return {
    id: r.id,
    customerId: r.customer_id,
    status: r.status,
    billing: r.billing,
    pricePence: r.price_pence,
    minMonths: r.min_months ?? 0,
    stripeSubscriptionId: r.stripe_subscription_id,
    currentPeriodEnd: r.current_period_end,
    cancelAt: r.cancel_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    lastServiceOn: r.last_service_on,
    paymentFailedAt: r.payment_failed_at,
    publicToken: r.public_token,
    createdAt: r.created_at,
  };
}

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
export const planDate = (iso: string) => DATE.format(new Date(iso));

// ---------------------------------------------------------------------------
// Prices (Settings).

function pence(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 100 ? n : null;
}

export async function planPrices(): Promise<PlanPrices> {
  const [month, year, min] = await Promise.all([
    getSetting("plan_month_pence").catch(() => null),
    getSetting("plan_year_pence").catch(() => null),
    getSetting("plan_min_months").catch(() => null),
  ]);
  const minMonths = Number(min);
  return { monthPence: pence(month), yearPence: pence(year), minMonths: Number.isInteger(minMonths) && minMonths > 0 && minMonths <= 24 ? minMonths : 0 };
}

/** A price is set and Stripe is on: the plan can be joined online. */
export function planOpen(prices: PlanPrices): boolean {
  return paymentsOn() && !!(prices.monthPence || prices.yearPence);
}

/** "£12 a month or £130 a year". */
export function priceLine(prices: Pick<PlanPrices, "monthPence" | "yearPence">): string {
  return [prices.monthPence ? `${formatPence(prices.monthPence)} a month` : null, prices.yearPence ? `${formatPence(prices.yearPence)} a year` : null]
    .filter(Boolean)
    .join(" or ");
}

/** "There's a minimum term of 12 months." or "". */
export function minTermLine(minMonths: number): string {
  return minMonths > 0 ? `There's a minimum term of ${minMonths} month${minMonths === 1 ? "" : "s"}.` : "";
}

// ---------------------------------------------------------------------------
// Reading.

const UUID = /^[0-9a-f-]{36}$/i;
const LIVE: PlanStatus[] = ["active", "past_due"];

export function planLink(m: Pick<PlanMember, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/plan/${m.publicToken}`;
}

export async function getPlanMember(id: string): Promise<PlanMember | null> {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("plan_members").select("*").eq("id", id).maybeSingle();
  return data ? mapRow(data as Row) : null;
}

export async function planMemberByToken(token: string): Promise<PlanMember | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("plan_members").select("*").eq("public_token", token).maybeSingle();
  return data ? mapRow(data as Row) : null;
}

/** Their plan: the live one, else the latest (pending, or ended). Null if they've never had one. */
/** Which of these customers are on the plan (paid up, or a payment being sorted): free call-outs. */
export async function planMembersAmong(customerIds: string[]): Promise<Set<string>> {
  if (!customerIds.length) return new Set();
  const { data } = await createAdminClient().from("plan_members").select("customer_id").in("customer_id", [...new Set(customerIds)]).in("status", ["active", "past_due"]);
  return new Set((data ?? []).map((r) => r.customer_id as string));
}

export async function planFor(customerId: string): Promise<PlanMember | null> {
  const { data } = await createAdminClient()
    .from("plan_members")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = ((data ?? []) as Row[]).map(mapRow);
  return rows.find((m) => LIVE.includes(m.status)) ?? rows[0] ?? null;
}

/** Of these customers, the ones on the plan now: a "Plan" badge on the schedule. */
export async function onPlan(customerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const { data } = await createAdminClient().from("plan_members").select("customer_id").in("customer_id", ids).in("status", LIVE);
  return new Set((data ?? []).map((r) => r.customer_id as string));
}

/** Everyone on the plan, and anyone who's left in the last 90 days. */
export async function listPlanMembers(): Promise<PlanMember[]> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await createAdminClient()
    .from("plan_members")
    .select("*")
    .or(`status.in.(active,past_due),and(status.eq.ended,ended_at.gte.${since})`)
    .order("started_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as Row[]).map(mapRow);
}

/** When their plan will end if they cancel now: the end of what they've paid for, or of the minimum term. */
export function earliestEnd(m: Pick<PlanMember, "currentPeriodEnd" | "startedAt" | "minMonths">): Date | null {
  if (!m.currentPeriodEnd) return null;
  const periodEnd = new Date(m.currentPeriodEnd);
  if (!m.minMonths || !m.startedAt) return periodEnd;
  const minEnd = addMonths(new Date(m.startedAt), m.minMonths);
  return minEnd > periodEnd ? minEnd : periodEnd;
}

// ---------------------------------------------------------------------------
// Joining.

/** Their link to join: an open one if they have it, else a new one. */
export async function pendingPlanFor(customerId: string, staffId: string | null): Promise<PlanMember | null> {
  const current = await planFor(customerId);
  if (current && (LIVE.includes(current.status) || current.status === "pending")) return current;
  const { data, error } = await createAdminClient()
    .from("plan_members")
    .insert({ customer_id: customerId, created_by: staffId })
    .select("*")
    .single();
  if (error || !data) {
    console.error("maintenance-plan: couldn't start a plan", error);
    return null;
  }
  return mapRow(data as Row);
}

const hi = (c: Pick<Customer, "name">) => (c.name ? `Hi ${c.name.split(" ")[0]}, ` : "Hi, ");
const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function planEmail(params: { name: string | null; heading: string; paragraphs: string[]; cta?: { label: string; url: string } }): string {
  return renderEmailLayout({
    previewText: params.paragraphs[0].slice(0, 100),
    heading: params.heading,
    bodyHtml: `<p ${P}>${params.name ? `Hi ${escapeHtml(params.name.split(" ")[0])},` : "Hi,"}</p>${params.paragraphs.map((p) => `<p ${P}>${escapeHtml(p)}</p>`).join("")}`,
    ...(params.cta ? { ctaLabel: params.cta.label, ctaUrl: params.cta.url } : {}),
    secondaryCtaLabel: `Call ${business.phoneDisplay}`,
    secondaryCtaUrl: business.phoneHref,
  });
}

/** Fergal's "Send them the plan": their link, by every way we can reach them. */
export async function sendPlanInvite(customerId: string, staffId: string): Promise<{ ok: true; sentVia: string[] } | { ok: false; error: string }> {
  const prices = await planPrices();
  if (!planOpen(prices)) return { ok: false, error: "Set the plan's price in Settings first." };
  const customer = await getCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };
  const member = await pendingPlanFor(customerId, staffId);
  if (!member) return { ok: false, error: "Couldn't save that. Please try again." };
  if (LIVE.includes(member.status)) return { ok: false, error: "They're already on the plan." };
  const link = planLink(member);
  const what = PLAN_BENEFITS.map((b) => b.charAt(0).toLowerCase() + b.slice(1)).join(" and ");
  const body = `${hi(customer)}here are the details of our maintenance plan: ${what}, for ${priceLine(prices)}. ${minTermLine(prices.minMonths)} Join here: ${link}`
    .replace(/\s+/g, " ")
    .trim();
  const sentVia = await deliverToCustomer(customer, {
    body,
    headline: `Our ${PLAN_NAME.toLowerCase()}`,
    staffId,
    pushHref: `/plan/${member.publicToken}`,
    smsOptOut: true,
    emailHtml: () =>
      planEmail({
        name: customer.name,
        heading: `Our ${PLAN_NAME.toLowerCase()}`,
        paragraphs: [`Here are the details of our maintenance plan: ${what}.`, `It's ${priceLine(prices)}. ${minTermLine(prices.minMonths)}`.trim()],
        cta: { label: "See the plan and join", url: link },
      }),
  });
  return { ok: true, sentVia };
}

/** Pay to join: Stripe Checkout for a subscription, monthly or yearly at today's price. */
export async function planCheckoutUrl(token: string, billing: PlanBilling): Promise<{ url: string } | { error: string }> {
  const member = await planMemberByToken(token);
  if (!member) return { error: "That link isn't valid any more." };
  if (LIVE.includes(member.status)) return { error: "You're already on the plan." };
  if (member.status === "ended") return { error: "That plan has ended. Ask us for a new link, or join again from your account." };
  const prices = await planPrices();
  const price = billing === "month" ? prices.monthPence : prices.yearPence;
  if (!planOpen(prices) || !price) return { error: "Joining online isn't available just now. Please call us." };
  const customer = await getCustomer(member.customerId);
  if (!customer) return { error: "That link isn't valid any more." };

  await createAdminClient()
    .from("plan_members")
    .update({ billing, price_pence: price, min_months: prices.minMonths, updated_at: new Date().toISOString() })
    .eq("id", member.id)
    .eq("status", "pending");

  const link = planLink(member);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await stripeCustomerFor(customer),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: price,
          recurring: { interval: billing },
          product_data: { name: `${business.name} ${PLAN_NAME.toLowerCase()}`, description: PLAN_BENEFITS.join(". ") },
        },
      },
    ],
    subscription_data: {
      ...subscriptionFee(),
      description: `${business.name} ${PLAN_NAME.toLowerCase()} (${billing === "month" ? "monthly" : "yearly"})`,
      metadata: { kind: "plan", plan_member_id: member.id },
    },
    metadata: { kind: "plan", plan_member_id: member.id },
    success_url: `${link}?joined=1`,
    cancel_url: link,
  });
  if (!session.url) return { error: "Couldn't start the payment." };
  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Stripe's side (the webhook).

function statusFrom(sub: Stripe.Subscription): PlanStatus | null {
  if (sub.status === "active" || sub.status === "trialing") return "active";
  if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return "ended";
  return null;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function cancelAt(sub: Stripe.Subscription): string | null {
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000).toISOString();
  return sub.cancel_at_period_end ? periodEnd(sub) : null;
}

/** Checkout finished: the plan is theirs. Safe to repeat. */
export async function openPlan(memberId: string, subscriptionId: string): Promise<void> {
  const admin = createAdminClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const status = statusFrom(sub) ?? "active";
  const { data, error } = await admin
    .from("plan_members")
    .update({
      status,
      stripe_subscription_id: subscriptionId,
      started_at: new Date(sub.start_date * 1000).toISOString(),
      current_period_end: periodEnd(sub),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("status", "pending")
    .select("*");
  if (error) throw new Error(`maintenance-plan: couldn't open ${memberId}: ${error.message}`);
  const row = (data?.[0] as Row | undefined) ?? null;
  if (!row) return; // Already open: a resent event.
  const member = mapRow(row);
  const customer = await getCustomer(member.customerId);
  if (!customer) return;
  await alertTeam("New plan member", `${customer.name || customer.email || "A customer"} joined the maintenance plan (${formatPence(member.pricePence ?? 0)} ${BILLING_LABEL[member.billing ?? "month"]}).`, `/staff/customers/${customer.id}`);
  const what = PLAN_BENEFITS.map((b) => b.charAt(0).toLowerCase() + b.slice(1)).join(" and ");
  const account = `${CLUB_SITE_URL.replace(/\/$/, "")}/account#plan`;
  await deliverToCustomer(customer, {
    body: `${hi(customer)}welcome to the MPE maintenance plan. You've got ${what}. If your boiler breaks down, call ${business.phoneDisplay} or message us here. Manage your plan: ${account}`,
    headline: "Welcome to the plan",
    staffId: null,
    pushHref: "/account#plan",
    emailHtml: () =>
      planEmail({
        name: customer.name,
        heading: "Welcome to the maintenance plan",
        paragraphs: [`You've got ${what}.`, `If your boiler breaks down, call ${business.phoneDisplay} or message us and we'll get to you.`],
        cta: { label: "Manage your plan", url: account },
      }),
  });
}

/** A change on Stripe's side (renewed, cancelling, kept, ended): the row follows it. */
export async function syncPlanSubscription(sub: Stripe.Subscription): Promise<void> {
  const memberId = sub.metadata?.plan_member_id;
  if (!memberId) return;
  const before = await getPlanMember(memberId);
  if (!before || before.status === "pending") return; // Not opened yet: openPlan will read it fresh.
  const status = statusFrom(sub) ?? before.status;
  const update = {
    status,
    current_period_end: periodEnd(sub),
    cancel_at: status === "ended" ? before.cancelAt : cancelAt(sub),
    ...(status === "ended" && !before.endedAt ? { ended_at: new Date((sub.ended_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString() } : {}),
    ...(status === "active" ? { payment_failed_at: null } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await createAdminClient().from("plan_members").update(update).eq("id", memberId);
  if (error) throw new Error(`maintenance-plan: couldn't sync ${memberId}: ${error.message}`);
  if (status === "ended" && before.status !== "ended") {
    const customer = await getCustomer(before.customerId);
    await alertTeam("Plan ended", `${customer?.name || "A customer"}'s maintenance plan has ended.`, `/staff/customers/${before.customerId}`);
  }
}

/** A plan payment failed: they're told how to fix it, and the team knows. */
export async function planPaymentFailed(memberId: string, invoice: Stripe.Invoice): Promise<void> {
  const member = await getPlanMember(memberId);
  if (!member || member.status === "pending" || member.status === "ended") return;
  // Once per invoice: Stripe retries, and sends this each time.
  if (member.paymentFailedAt && invoice.attempt_count > 1) return;
  await createAdminClient().from("plan_members").update({ status: "past_due", payment_failed_at: new Date().toISOString() }).eq("id", member.id);
  const customer = await getCustomer(member.customerId);
  if (!customer) return;
  const link = invoice.hosted_invoice_url || `${CLUB_SITE_URL.replace(/\/$/, "")}/account#plan`;
  await deliverToCustomer(customer, {
    body: `${hi(customer)}your maintenance plan payment of ${formatPence(invoice.amount_due)} didn't go through. We'll try again in a few days, or you can pay or update your card here: ${link}`,
    headline: "Plan payment didn't go through",
    // Texted only if there's no email or app to tell them.
    text: "fallback",
    staffId: null,
    pushHref: "/account#plan",
    emailHtml: () =>
      planEmail({
        name: customer.name,
        heading: "Your plan payment didn't go through",
        paragraphs: [`Your maintenance plan payment of ${formatPence(invoice.amount_due)} didn't go through. We'll try again in a few days, or you can pay or update your card now.`],
        cta: { label: "Pay or update your card", url: link },
      }),
  });
  await alertTeam("Plan payment failed", `${customer.name || "A customer"}'s plan payment of ${formatPence(invoice.amount_due)} didn't go through. They've been sent a link to fix it.`, `/staff/customers/${customer.id}`);
}

// ---------------------------------------------------------------------------
// Managing.

/**
 * Cancels: it runs to the end of what they've paid for, or the end of the
 * minimum term, then stops. `now` (the team only) ends it straight away.
 */
export async function cancelPlan(memberId: string, opts: { now?: boolean } = {}): Promise<{ ok: true; endsOn: string | null } | { ok: false; error: string }> {
  const member = await getPlanMember(memberId);
  if (!member) return { ok: false, error: "Plan not found." };
  if (member.status === "pending") {
    await createAdminClient().from("plan_members").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", member.id).eq("status", "pending");
    return { ok: true, endsOn: null };
  }
  if (!member.stripeSubscriptionId || member.status === "ended") return { ok: false, error: "That plan has already ended." };
  try {
    if (opts.now) {
      await stripe.subscriptions.cancel(member.stripeSubscriptionId, { prorate: false, invoice_now: false });
      await createAdminClient().from("plan_members").update({ status: "ended", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", member.id);
      return { ok: true, endsOn: null };
    }
    const end = earliestEnd(member);
    const sub = await stripe.subscriptions.update(member.stripeSubscriptionId, end ? { cancel_at: Math.floor(end.getTime() / 1000), proration_behavior: "none" } : { cancel_at_period_end: true });
    const at = cancelAt(sub);
    await createAdminClient().from("plan_members").update({ cancel_at: at, updated_at: new Date().toISOString() }).eq("id", member.id);
    return { ok: true, endsOn: at };
  } catch (err) {
    console.error("maintenance-plan: cancel failed", member.id, err);
    return { ok: false, error: "Couldn't cancel just now. Please try again, or call us." };
  }
}

/** Changed their mind before it ended: it carries on. */
export async function keepPlan(memberId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await getPlanMember(memberId);
  if (!member?.stripeSubscriptionId || !LIVE.includes(member.status)) return { ok: false, error: "That plan has already ended." };
  try {
    const sub = await stripe.subscriptions.retrieve(member.stripeSubscriptionId);
    await stripe.subscriptions.update(member.stripeSubscriptionId, sub.cancel_at && !sub.cancel_at_period_end ? { cancel_at: "" } : { cancel_at_period_end: false });
    await createAdminClient().from("plan_members").update({ cancel_at: null, updated_at: new Date().toISOString() }).eq("id", member.id);
    return { ok: true };
  } catch (err) {
    console.error("maintenance-plan: keep failed", member.id, err);
    return { ok: false, error: "Couldn't do that just now. Please try again, or call us." };
  }
}

/** Their free yearly service, done: shown to the team so they know when the next is due. */
export async function recordPlanService(customerId: string, day: string): Promise<void> {
  await createAdminClient().from("plan_members").update({ last_service_on: day }).eq("customer_id", customerId).in("status", LIVE);
}

/**
 * Stripe's billing page for the customer: update their card, see their
 * payments and receipts. Cancelling is on our side, so the minimum term
 * is kept to (Kanvas Academy's lib/billing-portal.ts).
 */
const PORTAL_TAG = "mpe-billing-v1";
let portalConfig: string | null = null;

async function portalConfigurationId(): Promise<string | undefined> {
  if (portalConfig) return portalConfig;
  try {
    const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const found = existing.data.find((c) => c.metadata?.mpe === PORTAL_TAG);
    if (found) return (portalConfig = found.id);
    const site = CLUB_SITE_URL.replace(/\/$/, "");
    const created = await stripe.billingPortal.configurations.create({
      metadata: { mpe: PORTAL_TAG },
      business_profile: { headline: `${business.name}: your payments`, privacy_policy_url: `${site}/privacy`, terms_of_service_url: `${site}/terms` },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ["email", "address"] },
        subscription_update: { enabled: false },
        subscription_cancel: { enabled: false },
      },
    });
    return (portalConfig = created.id);
  } catch (err) {
    console.error("maintenance-plan: portal configuration failed, using the default", err);
    return undefined;
  }
}

export async function billingPortalUrl(customerId: string, returnPath: string): Promise<string | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !paymentsOn()) return null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: await stripeCustomerFor(customer),
      return_url: `${CLUB_SITE_URL.replace(/\/$/, "")}${returnPath}`,
      ...(await portalConfigurationId().then((id) => (id ? { configuration: id } : {}))),
    });
    return session.url;
  } catch (err) {
    console.error("maintenance-plan: portal failed", err);
    return null;
  }
}

async function alertTeam(title: string, body: string, href: string): Promise<void> {
  try {
    await pushToUsers(await chatRecipientIds(), { title, body, data: { kind: "link", href } });
  } catch (err) {
    console.error("maintenance-plan: team alert failed", err);
  }
}
