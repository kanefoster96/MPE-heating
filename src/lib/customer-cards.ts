import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { CLUB_SITE_URL } from "@/lib/club";
import { getCustomer } from "@/lib/customers";
import { paymentsOn, stripeCustomerFor } from "@/lib/payments";

/**
 * The cards a customer has saved with MPE, for their account page: which
 * one their plan and any monthly payments come from, adding a new one,
 * and removing one they don't want kept (not one that's in use: they
 * change that card first). Plus their plan's payment history from Stripe.
 */

export type CardOnFile = { id: string; brand: string; last4: string; expires: string; expired: boolean; usedFor: string[] };
export type PlanPayment = { id: string; date: string; amountPence: number; status: "paid" | "open" | "other"; url: string | null };

async function stripeCustomerId(customerId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("customers").select("stripe_customer_id").eq("id", customerId).maybeSingle();
  return (data?.stripe_customer_id as string | null) ?? null;
}

/** Which of their cards are in use, and for what. */
async function cardsInUse(customerId: string, stripeCustomer: string): Promise<Map<string, string[]>> {
  const admin = createAdminClient();
  const uses = new Map<string, string[]>();
  const add = (pm: string | null | undefined, what: string) => {
    if (pm) uses.set(pm, [...(uses.get(pm) ?? []), what]);
  };
  const [{ data: monthly }, { data: plan }] = await Promise.all([
    admin.from("payment_requests").select("number, plan_payment_method").eq("customer_id", customerId).eq("status", "open").in("plan_status", ["active", "past_due"]),
    admin.from("plan_members").select("stripe_subscription_id").eq("customer_id", customerId).in("status", ["active", "past_due"]).maybeSingle(),
  ]);
  for (const m of monthly ?? []) add(m.plan_payment_method as string | null, `Monthly payments for invoice MPE-${m.number}`);
  if (plan?.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id as string);
      let pm = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id;
      if (!pm) {
        const customer = await stripe.customers.retrieve(stripeCustomer);
        if (!customer.deleted) {
          const fallback = customer.invoice_settings?.default_payment_method;
          pm = typeof fallback === "string" ? fallback : fallback?.id;
        }
      }
      add(pm, "Your maintenance plan");
    } catch (err) {
      console.error("customer-cards: couldn't read the plan's card", err);
    }
  }
  return uses;
}

export async function cardsFor(customerId: string): Promise<CardOnFile[]> {
  if (!paymentsOn()) return [];
  const stripeCustomer = await stripeCustomerId(customerId);
  if (!stripeCustomer) return [];
  try {
    const [{ data: methods }, uses] = await Promise.all([stripe.customers.listPaymentMethods(stripeCustomer, { type: "card", limit: 20 }), cardsInUse(customerId, stripeCustomer)]);
    const now = new Date();
    return methods
      .filter((m) => m.card)
      .map((m) => ({
        id: m.id,
        brand: m.card!.brand.charAt(0).toUpperCase() + m.card!.brand.slice(1),
        last4: m.card!.last4,
        expires: `${String(m.card!.exp_month).padStart(2, "0")}/${String(m.card!.exp_year).slice(-2)}`,
        expired: m.card!.exp_year < now.getFullYear() || (m.card!.exp_year === now.getFullYear() && m.card!.exp_month < now.getMonth() + 1),
        usedFor: uses.get(m.id) ?? [],
      }));
  } catch (err) {
    console.error("customer-cards: couldn't list cards", err);
    return [];
  }
}

/** Removes a saved card: only one of theirs, and not one their plan or monthly payments use. */
export async function removeCard(customerId: string, paymentMethodId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cards = await cardsFor(customerId);
  const card = cards.find((c) => c.id === paymentMethodId);
  if (!card) return { ok: false, error: "That card isn't saved with us." };
  if (card.usedFor.length) return { ok: false, error: `That card's in use (${card.usedFor.join(", ")}). Add another card and switch to it first.` };
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { ok: true };
  } catch (err) {
    console.error("customer-cards: couldn't remove a card", err);
    return { ok: false, error: "Couldn't remove it just now. Please try again." };
  }
}

/** Save a new card (Stripe Checkout in setup mode): nothing is charged. */
export async function addCardUrl(customerId: string, returnPath: string): Promise<string | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !paymentsOn()) return null;
  const site = CLUB_SITE_URL.replace(/\/$/, "");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      currency: "gbp",
      customer: await stripeCustomerFor(customer),
      metadata: { kind: "card_added", customer_id: customer.id },
      success_url: `${site}${returnPath}${returnPath.includes("?") ? "&" : "?"}card=added`,
      cancel_url: `${site}${returnPath}`,
    });
    return session.url;
  } catch (err) {
    console.error("customer-cards: couldn't start adding a card", err);
    return null;
  }
}

/** Their maintenance plan's payments, newest first, each with its receipt or pay link. */
export async function planPaymentsFor(customerId: string): Promise<PlanPayment[]> {
  if (!paymentsOn()) return [];
  const { data } = await createAdminClient()
    .from("plan_members")
    .select("stripe_subscription_id")
    .eq("customer_id", customerId)
    .not("stripe_subscription_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  const subs = (data ?? []).map((r) => r.stripe_subscription_id as string);
  if (!subs.length) return [];
  try {
    const lists = await Promise.all(subs.map((subscription) => stripe.invoices.list({ subscription, limit: 24 })));
    return lists
      .flatMap((l) => l.data)
      .filter((inv) => inv.amount_due > 0 && inv.status !== "draft" && inv.status !== "void")
      .map((inv) => ({
        id: inv.id ?? String(inv.created),
        date: new Date(inv.created * 1000).toISOString(),
        amountPence: inv.status === "paid" ? inv.amount_paid : inv.amount_due,
        status: inv.status === "paid" ? ("paid" as const) : inv.status === "open" ? ("open" as const) : ("other" as const),
        url: inv.hosted_invoice_url ?? null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("customer-cards: couldn't list plan payments", err);
    return [];
  }
}
