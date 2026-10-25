import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, subscriptionFee } from "@/lib/stripe";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { addMonths, instalmentSchedule, scheduleSummary } from "@/lib/instalment-schedule";
import {
  alertTeam,
  formatPence,
  getPaymentByToken,
  getPaymentRequest,
  invoiceNumber,
  payLink,
  sendReceipt,
  stripeCustomerFor,
  type PaymentRequest,
} from "@/lib/payments";

/**
 * Paying an invoice monthly. Fergal ticks "Let them pay monthly" on an
 * invoice and picks how many payments (up to 12) and any deposit; the pay
 * page then offers that next to paying in full. Choosing it is a Stripe
 * subscription: today's payment (the deposit and the first month), then
 * the same each month, taken from their card automatically. It ends itself
 * after the last payment, and the invoice is marked paid.
 *
 * A payment that fails: they're sent Stripe's link to pay it or change
 * card, and the team's told. Stripe tries again over the following days.
 */

export type InstalmentProgress = { paidCount: number; paidPence: number; nextOn: string | null };

/** How far they've got: payments in, what's in, and when the next is due. */
export async function instalmentProgress(requests: Pick<PaymentRequest, "id" | "instalments" | "planStatus" | "planStartedAt">[]): Promise<Map<string, InstalmentProgress>> {
  const map = new Map<string, InstalmentProgress>();
  const onPlan = requests.filter((r) => r.planStatus);
  if (!onPlan.length) return map;
  const { data } = await createAdminClient()
    .from("instalment_payments")
    .select("payment_request_id, amount_pence")
    .in("payment_request_id", onPlan.map((r) => r.id));
  for (const r of onPlan) {
    const rows = (data ?? []).filter((d) => d.payment_request_id === r.id);
    const paidCount = rows.length;
    const live = r.planStatus === "active" || r.planStatus === "past_due";
    map.set(r.id, {
      paidCount,
      paidPence: rows.reduce((sum, d) => sum + (d.amount_pence as number), 0),
      nextOn: live && r.planStartedAt && r.instalments && paidCount < r.instalments.months ? addMonths(new Date(r.planStartedAt), paidCount).toISOString() : null,
    });
  }
  return map;
}

/** "Pay monthly" on the pay page: Stripe Checkout for the subscription. */
export async function instalmentCheckoutUrl(token: string): Promise<{ url: string } | { error: string }> {
  const p = await getPaymentByToken(token);
  if (!p) return { error: "Payment not found." };
  if (p.status !== "open") return { error: p.status === "paid" ? "That's already paid. Thank you!" : "That payment was cancelled." };
  if (p.planStatus) return { error: "You're already paying this monthly." };
  if (!p.instalments) return { error: "Monthly payments aren't available for this one." };
  const plan = instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence);
  if (!plan.ok) return { error: "Monthly payments aren't available for this one. Please call us." };
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  if (!customer) return { error: "Monthly payments aren't available for this one. Please call us." };
  const s = plan.schedule;
  const name = `${business.name} invoice ${invoiceNumber(p.number)}`;
  const link = payLink(p);
  const upFront = s.firstPence - s.monthlyPence;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await stripeCustomerFor(customer),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: s.monthlyPence,
          recurring: { interval: "month" },
          product_data: { name: `${name}: monthly payment`, description: `${s.months} payments in all, interest-free. ${p.description}` },
        },
      },
      ...(upFront > 0
        ? [{ quantity: 1, price_data: { currency: "gbp", unit_amount: upFront, product_data: { name: s.depositPence > 0 ? `${name}: deposit` : `${name}: first payment balance` } } }]
        : []),
    ],
    subscription_data: {
      ...subscriptionFee(),
      description: `${name}, ${scheduleSummary(s, formatPence)}`,
      metadata: { kind: "instalments", payment_request_id: p.id, payments: String(s.months) },
    },
    metadata: { kind: "instalments", payment_request_id: p.id },
    success_url: `${link}?monthly=1`,
    cancel_url: link,
  });
  if (!session.url) return { error: "Couldn't start the payment." };
  return { url: session.url };
}

/**
 * They've set it up (Checkout finished, or its first payment came in
 * first). Also tells Stripe to stop it a fortnight after the last payment
 * is due, so it can never run on, whatever happens to the webhook.
 */
export async function openInstalments(requestId: string, subscriptionId: string): Promise<void> {
  const admin = createAdminClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const startedAt = new Date(sub.start_date * 1000);
  const { data, error } = await admin
    .from("payment_requests")
    .update({ plan_status: "active", plan_subscription_id: subscriptionId, plan_started_at: startedAt.toISOString() })
    .eq("id", requestId)
    .eq("status", "open")
    .is("plan_status", null)
    .select("id");
  if (error) throw new Error(`instalments: couldn't open ${requestId}: ${error.message}`);
  if (!data?.length) return; // Already open: a resent event.
  const p = await getPaymentRequest(requestId);
  if (!p?.instalments) return;
  try {
    const stopAt = addMonths(startedAt, p.instalments.months - 1).getTime() + 15 * 86_400_000;
    await stripe.subscriptions.update(subscriptionId, { cancel_at: Math.floor(stopAt / 1000), proration_behavior: "none" });
  } catch (err) {
    console.error("instalments: couldn't set the end date", requestId, err);
  }
  const plan = instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence);
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  await alertTeam("Paying monthly", `${customer?.name || "A customer"} chose to pay ${invoiceNumber(p.number)} (${formatPence(p.amountPence)}) over ${p.instalments.months} months.`);
  if (!customer || !plan.ok) return;
  const s = plan.schedule;
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  const line = `${formatPence(s.monthlyPence)} a month for ${s.laterPayments} month${s.laterPayments === 1 ? "" : "s"}`;
  await deliverToCustomer(customer, {
    body: `${hi}thanks, you're paying invoice ${invoiceNumber(p.number)} monthly: ${formatPence(s.firstPence)} today, then ${line}, taken from your card automatically. See your payments: ${payLink(p)}`,
    headline: "Paying monthly",
    staffId: null,
    pushHref: `/pay/${p.publicToken}`,
    paymentRequestId: p.id,
    emailHtml: () =>
      renderEmailLayout({
        previewText: `Paying ${invoiceNumber(p.number)} monthly`,
        heading: "You're paying monthly",
        bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a">Thanks. You're paying invoice ${invoiceNumber(p.number)} monthly: ${formatPence(s.firstPence)} today, then ${line}, taken from your card automatically. No interest, nothing added.</p>`,
        ctaLabel: "See your payments",
        ctaUrl: payLink(p),
      }),
  });
}

/** A monthly payment came in: counted once; the last one marks the invoice paid and ends it. */
export async function instalmentPaid(requestId: string, invoice: Stripe.Invoice, subscriptionId: string): Promise<void> {
  if (!invoice.id || invoice.amount_paid <= 0) return;
  const admin = createAdminClient();
  const before = await getPaymentRequest(requestId);
  if (!before?.instalments) return;
  if (!before.planStatus) await openInstalments(requestId, subscriptionId);

  const { error } = await admin.from("instalment_payments").insert({
    payment_request_id: requestId,
    stripe_invoice_id: invoice.id,
    amount_pence: invoice.amount_paid,
    paid_at: new Date((invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  });
  if (error?.code === "23505") return; // Counted already.
  if (error) throw new Error(`instalments: couldn't record a payment for ${requestId}: ${error.message}`);

  const { count } = await admin.from("instalment_payments").select("id", { count: "exact", head: true }).eq("payment_request_id", requestId);
  if ((count ?? 0) < before.instalments.months) {
    await admin.from("payment_requests").update({ plan_status: "active" }).eq("id", requestId).eq("plan_status", "past_due");
    return;
  }
  // The last one.
  const { data: done } = await admin
    .from("payment_requests")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_via: "instalments", plan_status: "completed" })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id");
  try {
    await stripe.subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false });
  } catch (err) {
    // Already cancelled (its end date), or Stripe's busy: its end date stops it anyway.
    console.warn("instalments: couldn't cancel after the last payment", requestId, err);
  }
  if (!done?.length) return;
  await alertTeam("Paid in full", `${invoiceNumber(before.number)} (${formatPence(before.amountPence)}) is paid off: the last monthly payment came in.`);
  await sendReceipt(requestId, null);
}

/** A monthly payment didn't go through: their link to pay it or change card, once per payment. */
export async function instalmentFailed(requestId: string, invoice: Stripe.Invoice): Promise<void> {
  if (invoice.attempt_count > 1) return;
  const p = await getPaymentRequest(requestId);
  if (!p || p.status !== "open" || !p.planStatus || p.planStatus === "completed" || p.planStatus === "stopped") return;
  await createAdminClient().from("payment_requests").update({ plan_status: "past_due" }).eq("id", requestId).in("plan_status", ["active", "past_due"]);
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  if (!customer) return;
  const link = invoice.hosted_invoice_url || payLink(p);
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  await deliverToCustomer(customer, {
    body: `${hi}your monthly payment of ${formatPence(invoice.amount_due)} for invoice ${invoiceNumber(p.number)} didn't go through. We'll try again in a few days, or you can pay it or change card here: ${link}`,
    headline: "Monthly payment didn't go through",
    staffId: null,
    pushHref: `/pay/${p.publicToken}`,
    emailHtml: () =>
      renderEmailLayout({
        previewText: "Your monthly payment didn't go through",
        heading: "Your monthly payment didn't go through",
        bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a">Your monthly payment of ${formatPence(invoice.amount_due)} for invoice ${invoiceNumber(p.number)} didn't go through. We'll try again in a few days, or you can pay it or change card now.</p>`,
        ctaLabel: "Pay or change card",
        ctaUrl: link,
      }),
  });
  await alertTeam("Monthly payment failed", `${customer.name || "A customer"}'s ${formatPence(invoice.amount_due)} payment for ${invoiceNumber(p.number)} didn't go through. They've been sent a link to fix it.`);
}

/** It stopped before the last payment (cancelled, or Stripe gave up): the team's told what's left. */
export async function instalmentsEnded(requestId: string): Promise<void> {
  const p = await getPaymentRequest(requestId);
  if (!p || p.status !== "open" || (p.planStatus !== "active" && p.planStatus !== "past_due")) return;
  await createAdminClient().from("payment_requests").update({ plan_status: "stopped" }).eq("id", requestId).in("plan_status", ["active", "past_due"]);
  const progress = (await instalmentProgress([p])).get(p.id);
  const left = p.amountPence - (progress?.paidPence ?? 0);
  await alertTeam("Monthly payments stopped", `${invoiceNumber(p.number)}'s monthly payments have stopped with ${formatPence(left)} still to pay.`);
}

/** The team's "Stop monthly payments". */
export async function stopInstalments(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await createAdminClient().from("payment_requests").select("plan_subscription_id, plan_status").eq("id", requestId).maybeSingle();
  if (!data?.plan_subscription_id || (data.plan_status !== "active" && data.plan_status !== "past_due")) return { ok: false, error: "They're not paying this monthly." };
  try {
    await stripe.subscriptions.cancel(data.plan_subscription_id as string, { prorate: false, invoice_now: false });
  } catch (err) {
    console.error("instalments: stop failed", requestId, err);
    return { ok: false, error: "Couldn't stop it just now. Try again, or cancel it in Stripe." };
  }
  await instalmentsEnded(requestId);
  return { ok: true };
}
