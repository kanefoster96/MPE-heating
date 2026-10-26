import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, paymentFee } from "@/lib/stripe";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { instalmentSchedule, nextPaymentDate, ordinal, paymentDay } from "@/lib/instalment-schedule";
import { londonNow } from "@/lib/schedule-time";
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
 * Paying an invoice monthly, on set dates, until it's paid. Fergal ticks
 * "Let them pay monthly" on an invoice and picks how many payments (up to
 * 12) and any deposit. The pay page offers it next to paying in full.
 *
 * Choosing it: they pay the deposit and the first month today, by Stripe
 * Checkout, and that saves their card. Then on the same date each month
 * (lib/follow-up-sweep.ts) the card's charged the monthly amount, or
 * what's left if that's less, so the last payment is never more than the
 * balance. Nothing ends until the balance is £0: a month that fails is
 * still owed, they're sent the link to pay it, and the dates carry on.
 *
 * Any time, they can pay off any amount from the pay page, or the rest in
 * one go, and Fergal can record money taken in person. Every payment comes
 * off the balance, and the dates and monthly amount stay the same, so
 * paying extra just means it's done sooner.
 */

export type InstalmentPayment = { amountPence: number; kind: "first" | "monthly" | "extra" | "in_person"; paidVia: string | null; paidAt: string };
export type InstalmentProgress = {
  paidCount: number;
  paidPence: number;
  balancePence: number;
  /** The next scheduled payment, while it's running. */
  nextOn: string | null;
  nextPence: number | null;
  payments: InstalmentPayment[];
};

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });
const dateLine = (isoDate: string) => DATE.format(new Date(`${isoDate}T12:00:00Z`));
const hi = (name: string | null) => (name ? `Hi ${name.split(" ")[0]}, ` : "Hi, ");
const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';
const MIN_PAY_OFF_PENCE = 100;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** What's in, what's left, and what's next, for each invoice being paid monthly (or, with `all`, any paid in parts). */
export async function instalmentProgress(
  requests: Pick<PaymentRequest, "id" | "amountPence" | "planStatus" | "planMonthlyPence" | "planNextDueOn">[],
  all = false,
): Promise<Map<string, InstalmentProgress>> {
  const map = new Map<string, InstalmentProgress>();
  const onPlan = all ? requests : requests.filter((r) => r.planStatus);
  if (!onPlan.length) return map;
  const { data } = await createAdminClient()
    .from("instalment_payments")
    .select("payment_request_id, amount_pence, kind, paid_via, paid_at")
    .in("payment_request_id", onPlan.map((r) => r.id))
    .order("paid_at");
  for (const r of onPlan) {
    const payments = (data ?? [])
      .filter((d) => d.payment_request_id === r.id)
      .map((d) => ({ amountPence: d.amount_pence as number, kind: d.kind as InstalmentPayment["kind"], paidVia: (d.paid_via as string | null) ?? null, paidAt: d.paid_at as string }));
    const paidPence = payments.reduce((sum, p) => sum + p.amountPence, 0);
    const balancePence = Math.max(0, r.amountPence - paidPence);
    const running = (r.planStatus === "active" || r.planStatus === "past_due") && balancePence > 0;
    map.set(r.id, {
      paidCount: payments.length,
      paidPence,
      balancePence,
      nextOn: running ? r.planNextDueOn : null,
      nextPence: running && r.planMonthlyPence ? Math.min(r.planMonthlyPence, balancePence) : null,
      payments,
    });
  }
  return map;
}

async function progressFor(p: PaymentRequest): Promise<InstalmentProgress> {
  return (await instalmentProgress([p], true)).get(p.id) ?? { paidCount: 0, paidPence: 0, balancePence: p.amountPence, nextOn: null, nextPence: null, payments: [] };
}

// ---------------------------------------------------------------------------
// Starting, paying off, changing card: Stripe Checkout from the pay page.

/** "Pay monthly": today's payment by Checkout, saving their card for the dates that follow. */
export async function startMonthlyUrl(token: string): Promise<{ url: string } | { error: string }> {
  const p = await getPaymentByToken(token);
  if (!p) return { error: "Payment not found." };
  if (p.status !== "open") return { error: p.status === "paid" ? "That's already paid. Thank you!" : "That payment was cancelled." };
  if (p.planStatus) return { error: "You're already paying this monthly." };
  if (!p.instalments) return { error: "Monthly payments aren't available for this one." };
  // Part paid already (cash, say): the rest is paid in one go.
  if ((await progressFor(p)).paidPence > 0) return { error: "Part of this has been paid already, so the rest is paid in one go." };
  const plan = instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence);
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  if (!plan.ok || !customer) return { error: "Monthly payments aren't available for this one. Please call us." };
  const s = plan.schedule;
  const day = paymentDay(londonNow().dateISO);
  const name = `${business.name} invoice ${invoiceNumber(p.number)}`;
  const link = payLink(p);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: await stripeCustomerFor(customer),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: s.firstPence,
          product_data: { name: `${name}: ${s.depositPence > 0 ? "deposit and first monthly payment" : "first monthly payment"}`, description: p.description },
        },
      },
    ],
    payment_intent_data: {
      ...paymentFee(s.firstPence),
      setup_future_usage: "off_session",
      description: `${name}: first payment`,
      ...(customer.email ? { receipt_email: customer.email } : {}),
      metadata: { payment_request_id: p.id, instalment: "first", monthly_pence: String(s.monthlyPence) },
    },
    custom_text: {
      submit: {
        message: `You agree to ${business.name} taking ${formatPence(s.monthlyPence)} from this card on the ${ordinal(day)} of each month, or what's left if that's less, until the ${formatPence(p.amountPence)} is paid. No interest, nothing added. You can pay off more whenever you like.`,
      },
    },
    metadata: { kind: "instalments", payment_request_id: p.id },
    success_url: `${link}?monthly=1`,
    cancel_url: link,
  });
  if (!session.url) return { error: "Couldn't start the payment." };
  return { url: session.url };
}

/** Pay something off now: any amount from £1 to what's left. */
export async function payOffUrl(token: string, amountPence: number): Promise<{ url: string } | { error: string }> {
  const p = await getPaymentByToken(token);
  if (!p || p.status !== "open" || !p.planStatus || p.planStatus === "completed") return { error: "There's nothing left to pay on this one." };
  const { balancePence } = await progressFor(p);
  const amount = Math.round(amountPence);
  if (!Number.isFinite(amount) || amount < MIN_PAY_OFF_PENCE) return { error: `Pay at least ${formatPence(MIN_PAY_OFF_PENCE)}.` };
  if (amount > balancePence) return { error: `There's only ${formatPence(balancePence)} left to pay.` };
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  const name = `${business.name} invoice ${invoiceNumber(p.number)}`;
  const link = payLink(p);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: amount, product_data: { name: amount === balancePence ? `${name}: the rest` : `${name}: paying some off` } } }],
    ...(customer ? { customer: await stripeCustomerFor(customer) } : {}),
    payment_intent_data: {
      ...paymentFee(amount),
      description: `${name}: ${amount === balancePence ? "the rest" : "paid off"}`,
      ...(customer?.email ? { receipt_email: customer.email } : {}),
      metadata: { payment_request_id: p.id, instalment: "extra" },
    },
    metadata: { kind: "instalments", payment_request_id: p.id },
    success_url: `${link}?paidoff=1`,
    cancel_url: link,
  });
  if (!session.url) return { error: "Couldn't start the payment." };
  return { url: session.url };
}

/** A new card for the monthly payments: Checkout saves it, and the webhook switches to it. */
export async function changeCardUrl(token: string): Promise<{ url: string } | { error: string }> {
  const p = await getPaymentByToken(token);
  if (!p || p.status !== "open" || (p.planStatus !== "active" && p.planStatus !== "past_due")) return { error: "There are no monthly payments to change the card for." };
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  if (!customer) return { error: "Please call us to change your card." };
  const link = payLink(p);
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    currency: "gbp",
    customer: await stripeCustomerFor(customer),
    setup_intent_data: { metadata: { payment_request_id: p.id, instalment: "card" } },
    metadata: { kind: "instalments_card", payment_request_id: p.id },
    success_url: `${link}?card=1`,
    cancel_url: link,
  });
  if (!session.url) return { error: "Couldn't open that just now." };
  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Recording payments.

/**
 * A payment towards the balance: counted once (a Stripe payment by its id),
 * and when the balance reaches £0 the invoice is paid, the dates stop and
 * they get their receipt (unless the caller sends it). Monthly payments,
 * and the parts of an invoice paid in parts (some cash, the rest by card).
 */
export async function recordTowardsBalance(params: {
  requestId: string;
  amountPence: number;
  kind: InstalmentPayment["kind"];
  paymentIntentId?: string | null;
  paidVia: string;
  staffId?: string | null;
  sendReceipt?: boolean;
}): Promise<"recorded" | "duplicate"> {
  const { error } = await createAdminClient()
    .from("instalment_payments")
    .insert({
      payment_request_id: params.requestId,
      amount_pence: params.amountPence,
      kind: params.kind,
      stripe_payment_intent_id: params.paymentIntentId ?? null,
      paid_via: params.paidVia,
      recorded_by: params.staffId ?? null,
    });
  if (error?.code === "23505") return "duplicate";
  if (error) throw new Error(`instalments: couldn't record a payment for ${params.requestId}: ${error.message}`);
  // Paying something after a failed month puts them back in good standing.
  if (params.kind !== "first") await createAdminClient().from("payment_requests").update({ plan_status: "active", plan_failed_at: null }).eq("id", params.requestId).eq("plan_status", "past_due");
  await settle(params.requestId, params.sendReceipt !== false);
  return "recorded";
}

/** Paid off: the invoice is marked paid. More than the balance (a payment crossing another): the team's told to refund it. */
async function settle(requestId: string, receipt = true): Promise<void> {
  const p = await getPaymentRequest(requestId);
  if (!p || p.status !== "open") return;
  const progress = await progressFor(p);
  if (progress.paidPence < p.amountPence) return;
  // Paid monthly, or paid in parts (some cash, then the rest by card).
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update(
      p.planStatus
        ? { status: "paid", paid_at: new Date().toISOString(), paid_via: "instalments", plan_status: "completed", plan_next_due_on: null, plan_charging_at: null }
        : { status: "paid", paid_at: new Date().toISOString(), paid_via: "part_payments", charging_at: null },
    )
    .eq("id", requestId)
    .eq("status", "open")
    .select("id");
  if (!data?.length) return;
  await alertTeam(p.planStatus ? "Paid off" : "Paid in full", `${p.kind === "callout_fee" ? "A call-out fee" : invoiceNumber(p.number)} (${formatPence(p.amountPence)}) is ${p.planStatus ? "paid off" : "paid in full"}.`);
  if (p.customerId) {
    const { rewardReferralFor } = await import("@/lib/referrals");
    await rewardReferralFor(p.customerId).catch((err) => console.error("instalments: referral reward failed", err));
  }
  if (progress.paidPence > p.amountPence) {
    await alertTeam("Overpaid", `${invoiceNumber(p.number)} was overpaid by ${formatPence(progress.paidPence - p.amountPence)}. Refund the difference in Stripe.`);
  }
  if (receipt) await sendReceipt(requestId, null);
}

/** The webhook: a Stripe payment towards a monthly invoice. True when it was one. */
export async function handleInstalmentIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const requestId = intent.metadata?.payment_request_id;
  const kind = intent.metadata?.instalment;
  if (!requestId || (kind !== "first" && kind !== "monthly" && kind !== "extra")) return false;
  if (kind === "first") {
    await openMonthly(requestId, intent);
    return true;
  }
  await recordTowardsBalance({
    requestId,
    amountPence: intent.amount_received || intent.amount,
    kind,
    paymentIntentId: intent.id,
    // The rest of one paid in parts says how (Tap to Pay, saved card, link).
    paidVia: intent.metadata?.via || (kind === "monthly" ? "saved_card" : "link"),
  });
  return true;
}

/** Their first payment's in: the dates start, from their saved card. */
async function openMonthly(requestId: string, intent: Stripe.PaymentIntent): Promise<void> {
  const p = await getPaymentRequest(requestId);
  if (!p) return;
  const today = londonNow().dateISO;
  const day = paymentDay(today);
  const monthly = Number(intent.metadata?.monthly_pence) || null;
  const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id ?? null;
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update({
      plan_status: "active",
      plan_started_at: new Date().toISOString(),
      plan_monthly_pence: monthly,
      plan_next_due_on: nextPaymentDate(today, day),
      plan_payment_method: paymentMethod,
    })
    .eq("id", requestId)
    .eq("status", "open")
    .is("plan_status", null)
    .select("id");
  // Paid in full another way meanwhile, or a resent event: the payment still counts (once).
  const result = await recordTowardsBalance({ requestId, amountPence: intent.amount_received || intent.amount, kind: "first", paymentIntentId: intent.id, paidVia: "link" });
  if (result === "duplicate") return;
  if (!data?.length) {
    const now = await getPaymentRequest(requestId);
    if (now?.status !== "open") await alertTeam("Payment needs refunding", `A first monthly payment came in for ${invoiceNumber(p.number)}, which was already ${now?.status ?? "gone"}. Refund it in Stripe.`);
    return;
  }

  const fresh = await getPaymentRequest(requestId);
  const customer = fresh?.customerId ? await getCustomer(fresh.customerId) : null;
  await alertTeam("Paying monthly", `${customer?.name || "A customer"} started paying ${invoiceNumber(p.number)} (${formatPence(p.amountPence)}) monthly.`);
  if (!fresh || !customer || fresh.status !== "open") return;
  const progress = await progressFor(fresh);
  const body = `${hi(customer.name)}thanks, you're paying invoice ${invoiceNumber(p.number)} monthly. ${formatPence(progress.paidPence)} paid today, ${formatPence(progress.balancePence)} to go: ${formatPence(Math.min(monthly ?? 0, progress.balancePence))} on the ${ordinal(day)} of each month from your card until it's paid, the first on ${dateLine(fresh.planNextDueOn!)}. You can pay off more any time: ${payLink(p)}`;
  await deliverToCustomer(customer, {
    body,
    headline: "Paying monthly",
    staffId: null,
    pushHref: `/pay/${p.publicToken}`,
    paymentRequestId: p.id,
    emailHtml: () =>
      renderEmailLayout({
        previewText: `Paying ${invoiceNumber(p.number)} monthly`,
        heading: "You're paying monthly",
        bodyHtml: `<p ${P}>${escapeHtml(body.replace(/ You can pay off more any time: .*$/, ""))}</p><p ${P}>No interest, nothing added. You can pay off more whenever you like.</p>`,
        ctaLabel: "See your payments",
        ctaUrl: payLink(p),
      }),
  });
}

/** A new card from the pay page: the monthly payments come from it from now on. */
export async function handleCardSetup(session: Stripe.Checkout.Session): Promise<void> {
  const requestId = session.metadata?.payment_request_id;
  const setupId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!requestId || !setupId) return;
  const setup = await stripe.setupIntents.retrieve(setupId);
  const paymentMethod = typeof setup.payment_method === "string" ? setup.payment_method : setup.payment_method?.id;
  if (!paymentMethod) return;
  await createAdminClient().from("payment_requests").update({ plan_payment_method: paymentMethod }).eq("id", requestId).in("plan_status", ["active", "past_due"]);
}

/** Fergal took some in person: it comes off the balance like any other payment. */
export async function recordInPersonInstalment(requestId: string, amountPence: number, via: "in_person" | "cash" | "bank_transfer", staffId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await getPaymentRequest(requestId);
  if (!p || p.status !== "open" || !p.planStatus) return { ok: false, error: "That isn't being paid monthly." };
  const { balancePence } = await progressFor(p);
  const amount = Math.round(amountPence);
  if (!Number.isFinite(amount) || amount < MIN_PAY_OFF_PENCE) return { ok: false, error: "Enter the amount they paid." };
  if (amount > balancePence) return { ok: false, error: `Only ${formatPence(balancePence)} is left to pay.` };
  await recordTowardsBalance({ requestId, amountPence: amount, kind: "in_person", paidVia: via, staffId });
  return { ok: true };
}

/** The team's "Stop monthly payments": no more dates; anything left can still be paid off. */
export async function stopInstalments(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update({ plan_status: "stopped", plan_next_due_on: null })
    .eq("id", requestId)
    .in("plan_status", ["active", "past_due"])
    .select("id");
  return data?.length ? { ok: true } : { ok: false, error: "They're not paying this monthly." };
}

/** Starts the dates again after a stop: the next one on their payment day. */
export async function restartInstalments(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await getPaymentRequest(requestId);
  if (!p || p.status !== "open" || p.planStatus !== "stopped" || !p.planStartedAt) return { ok: false, error: "That can't be restarted." };
  const day = paymentDay(new Date(p.planStartedAt).toISOString().slice(0, 10));
  await createAdminClient().from("payment_requests").update({ plan_status: "active", plan_next_due_on: nextPaymentDate(londonNow().dateISO, day) }).eq("id", requestId).eq("plan_status", "stopped");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The monthly payment date (lib/follow-up-sweep.ts).

type DueRow = { id: string; plan_monthly_pence: number | null; plan_next_due_on: string; plan_payment_method: string | null; plan_started_at: string | null };

/**
 * Takes each monthly payment that's due today (or was missed while the
 * sweep was down): the monthly amount, or what's left if less. Claimed
 * first so two runs can't both take it, and keyed by its date so Stripe
 * never takes the same month twice. Returns how many it tried.
 */
export async function takeDueInstalments(budget: () => boolean): Promise<number> {
  const admin = createAdminClient();
  const today = londonNow().dateISO;
  const { data } = await admin
    .from("payment_requests")
    .select("id, plan_monthly_pence, plan_next_due_on, plan_payment_method, plan_started_at")
    .eq("status", "open")
    .in("plan_status", ["active", "past_due"])
    .lte("plan_next_due_on", today)
    .limit(50);
  let tried = 0;
  for (const row of (data ?? []) as DueRow[]) {
    if (!budget()) break;
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("payment_requests")
      .update({ plan_charging_at: claimedAt })
      .eq("id", row.id)
      .eq("plan_next_due_on", row.plan_next_due_on)
      .or(`plan_charging_at.is.null,plan_charging_at.lt.${new Date(Date.now() - 10 * 60_000).toISOString()}`)
      .select("id");
    if (!claimed?.length) continue;
    tried++;
    await takeOne(row).catch((err) => console.error("instalments: monthly payment failed to run", row.id, err));
    await admin.from("payment_requests").update({ plan_charging_at: null }).eq("id", row.id).eq("plan_charging_at", claimedAt);
  }
  return tried;
}

async function takeOne(row: DueRow): Promise<void> {
  const admin = createAdminClient();
  const p = await getPaymentRequest(row.id);
  if (!p || p.status !== "open") return;
  const progress = await progressFor(p);
  const day = paymentDay((row.plan_started_at ?? `${row.plan_next_due_on}T00:00:00Z`).slice(0, 10));
  const nextDue = nextPaymentDate(row.plan_next_due_on, day);
  if (progress.balancePence <= 0) return settle(p.id);
  const amount = Math.min(row.plan_monthly_pence ?? progress.balancePence, progress.balancePence);
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  if (!customer) return;

  let failure: string | null = null;
  let intentId: string | null = null;
  if (!row.plan_payment_method) {
    failure = "no card saved";
  } else {
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "gbp",
          ...paymentFee(amount),
          customer: await stripeCustomerFor(customer),
          payment_method: row.plan_payment_method,
          off_session: true,
          confirm: true,
          description: `${business.name} invoice ${invoiceNumber(p.number)}: monthly payment`,
          ...(customer.email ? { receipt_email: customer.email } : {}),
          metadata: { payment_request_id: p.id, instalment: "monthly", due_on: row.plan_next_due_on },
        },
        { idempotencyKey: `mpe-monthly-${p.id}-${row.plan_next_due_on}` },
      );
      if (intent.status === "succeeded") intentId = intent.id;
      else {
        failure = "their bank wants them to approve it";
        // They'll pay it from the link instead: this one mustn't linger.
        await stripe.paymentIntents.cancel(intent.id).catch(() => undefined);
      }
    } catch (err) {
      failure = err instanceof Error && /authentic/i.test(err.message) ? "their bank wants them to approve it" : "the card was declined";
    }
  }

  if (intentId) {
    // The date moves on first: the webhook may have counted the payment already.
    await admin.from("payment_requests").update({ plan_status: "active", plan_failed_at: null, plan_next_due_on: nextDue }).eq("id", p.id).eq("status", "open");
    await recordTowardsBalance({ requestId: p.id, amountPence: amount, kind: "monthly", paymentIntentId: intentId, paidVia: "saved_card" });
    const after = await getPaymentRequest(p.id);
    if (after?.status !== "open") return; // Paid off: the receipt's gone.
    const left = progress.balancePence - amount;
    const nextAmount = Math.min(row.plan_monthly_pence ?? left, left);
    const body = `${hi(customer.name)}thanks, ${formatPence(amount)} taken for invoice ${invoiceNumber(p.number)}. ${formatPence(left)} to go: ${formatPence(nextAmount)} on ${dateLine(nextDue)}. Pay off more any time: ${payLink(p)}`;
    await deliverToCustomer(customer, {
      body,
      headline: "Monthly payment taken",
      staffId: null,
      pushHref: `/pay/${p.publicToken}`,
      email: "if-no-text",
      emailHtml: () =>
        renderEmailLayout({
          previewText: `${formatPence(amount)} taken, ${formatPence(left)} to go`,
          heading: "Monthly payment taken",
          bodyHtml: `<p ${P}>Thanks, ${formatPence(amount)} taken for invoice ${invoiceNumber(p.number)}. ${formatPence(left)} to go: ${formatPence(nextAmount)} on ${dateLine(nextDue)}.</p>`,
          ctaLabel: "See your payments",
          ctaUrl: payLink(p),
        }),
    });
    return;
  }

  // Didn't go through: still owed, the dates carry on, and they're asked to pay it.
  await admin.from("payment_requests").update({ plan_status: "past_due", plan_failed_at: new Date().toISOString(), plan_next_due_on: nextDue }).eq("id", p.id).eq("status", "open");
  const body = `${hi(customer.name)}your monthly payment of ${formatPence(amount)} for invoice ${invoiceNumber(p.number)} didn't go through. Please pay it, or change your card, here: ${payLink(p)} Any questions, just reply.`;
  await deliverToCustomer(customer, {
    body,
    headline: "Monthly payment didn't go through",
    staffId: null,
    pushHref: `/pay/${p.publicToken}`,
    emailHtml: () =>
      renderEmailLayout({
        previewText: "Your monthly payment didn't go through",
        heading: "Your monthly payment didn't go through",
        bodyHtml: `<p ${P}>Your monthly payment of ${formatPence(amount)} for invoice ${invoiceNumber(p.number)} didn't go through. Please pay it, or change your card, from your invoice page.</p>`,
        ctaLabel: "Pay or change card",
        ctaUrl: payLink(p),
      }),
  });
  await alertTeam("Monthly payment failed", `${customer.name || "A customer"}'s ${formatPence(amount)} for ${invoiceNumber(p.number)} didn't go through (${failure}). They've been sent the link to pay it.`);
}
