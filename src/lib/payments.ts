import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, paymentFee } from "@/lib/stripe";
import { CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { chatRecipientIds } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";
import { getCustomer, type Customer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { invoiceEmailHtml } from "@/lib/emails/invoice";
import { instalmentSchedule, scheduleSummary } from "@/lib/instalment-schedule";

/**
 * Taking payment for a job: Kanvas Academy's payment requests
 * (lib/payment-requests.ts there), for MPE's call-out fees and invoices.
 *
 * Fergal asks for a call-out fee or sends an invoice from the visit (or the
 * chat). It's saved, then sent to the customer every way we can reach them
 * as a message with a Pay link, and shows in their chat as a Pay card. They
 * pay by:
 *  - Stripe Checkout from the link (Apple Pay, Google Pay or card), with a
 *    tick to save the card with MPE for next time;
 *  - the card they saved, charged by Fergal when he's with them and they
 *    say yes ("Charge card ending 4242");
 *  - Tap to Pay on Fergal's phone, in the MPE app (lib endpoints below);
 *  - or in person another way, which Fergal marks: a card machine, cash or
 *    bank transfer.
 *
 * Every Stripe payment carries metadata.payment_request_id, and the Stripe
 * webhook's payment_intent.succeeded marks it paid, whichever way it came.
 * A second payment for one request is refunded straight away.
 */

/** The call-out fee the site promises: £50, taken off the repair if they go ahead. */
export const CALLOUT_FEE_PENCE = 5000;
/** At most this many add-ons on a pay page: Fergal's repair upsells (lib/products.ts). */
export const MAX_OFFERS = 2;

/** An add-on the customer can tick on the pay page, at an offer price. */
export type PaymentOffer = { productId: string | null; label: string; pence: number; usualPence: number | null; taken: boolean };
export const MAX_LINES = 20;
const MIN_TOTAL_PENCE = 100;
const MAX_TOTAL_PENCE = 2_000_000;

export type PaymentKind = "callout_fee" | "invoice" | "other";
export type PaymentStatus = "open" | "paid" | "cancelled";
export type PaidVia = "link" | "app" | "saved_card" | "tap_to_pay" | "in_person" | "cash" | "bank_transfer" | "instalments";
/** Paying an invoice monthly (lib/instalments.ts). */
export type PlanStatus = "active" | "past_due" | "completed" | "stopped";
export type PaymentLine = { description: string; amountPence: number };

export const PAID_VIA_LABEL: Record<PaidVia, string> = {
  link: "online",
  app: "in the app",
  saved_card: "saved card",
  tap_to_pay: "Tap to Pay",
  in_person: "card machine",
  cash: "cash",
  bank_transfer: "bank transfer",
  instalments: "monthly payments",
};

export type PaymentRequest = {
  id: string;
  customerId: string | null;
  conversationId: string | null;
  appointmentId: string | null;
  kind: PaymentKind;
  number: number;
  description: string;
  lines: PaymentLine[];
  amountPence: number;
  status: PaymentStatus;
  paidAt: string | null;
  paidVia: PaidVia | null;
  publicToken: string;
  reminderCount: number;
  remindedAt: string | null;
  createdAt: string;
  /** The add-on they can tick on the pay page (a discounted service), and whether they took it. */
  offers: PaymentOffer[];
  /** Fergal let them pay it monthly: over this many payments, any deposit taken with the first. */
  instalments: { months: number; depositPence: number } | null;
  /** Once they chose to pay monthly: how it's going, what's taken each month and when next. */
  planStatus: PlanStatus | null;
  planStartedAt: string | null;
  planMonthlyPence: number | null;
  planNextDueOn: string | null;
};

type Row = {
  id: string;
  customer_id: string | null;
  conversation_id: string | null;
  appointment_id: string | null;
  kind: PaymentKind;
  number: number;
  description: string;
  lines: { description: string; amount_pence: number }[] | null;
  amount_pence: number;
  status: PaymentStatus;
  paid_at: string | null;
  paid_via: PaidVia | null;
  stripe_payment_intent_id: string | null;
  charging_at: string | null;
  public_token: string;
  reminder_count: number | null;
  reminded_at: string | null;
  created_at: string;
  offers: { product_id: string | null; label: string; pence: number; usual_pence: number | null; taken: boolean }[] | null;
  quote_id: string | null;
  instalments: number | null;
  instalment_deposit_pence: number | null;
  plan_status: PlanStatus | null;
  plan_started_at: string | null;
  plan_monthly_pence: number | null;
  plan_next_due_on: string | null;
};

function mapRow(r: Row): PaymentRequest {
  return {
    id: r.id,
    customerId: r.customer_id,
    conversationId: r.conversation_id,
    appointmentId: r.appointment_id,
    kind: r.kind,
    number: r.number,
    description: r.description,
    lines: (r.lines ?? []).map((l) => ({ description: l.description, amountPence: l.amount_pence })),
    amountPence: r.amount_pence,
    status: r.status,
    paidAt: r.paid_at,
    paidVia: r.paid_via,
    publicToken: r.public_token,
    reminderCount: r.reminder_count ?? 0,
    remindedAt: r.reminded_at ?? null,
    createdAt: r.created_at,
    offers: (r.offers ?? []).map((o) => ({ productId: o.product_id ?? null, label: o.label, pence: o.pence, usualPence: o.usual_pence ?? null, taken: !!o.taken })),
    instalments: r.instalments ? { months: r.instalments, depositPence: r.instalment_deposit_pence ?? 0 } : null,
    planStatus: r.plan_status ?? null,
    planStartedAt: r.plan_started_at ?? null,
    planMonthlyPence: r.plan_monthly_pence ?? null,
    planNextDueOn: r.plan_next_due_on ?? null,
  };
}

/** £50, £12.50, −£50. */
export function formatPence(pence: number): string {
  const sign = pence < 0 ? "−" : "";
  const pounds = Math.abs(pence) / 100;
  return `${sign}£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "MPE-1002". */
export function invoiceNumber(n: number): string {
  return `MPE-${n}`;
}

export function paymentsOn(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** The customer's page for it: the invoice, and Pay. Private by its token, not the id. */
export function payLink(p: Pick<PaymentRequest, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/pay/${p.publicToken}`;
}

// ---------------------------------------------------------------------------
// Reading.

const UUID = /^[0-9a-f-]{36}$/i;

async function getRow(id: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("payment_requests").select("*").eq("id", id).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getPaymentRequest(id: string): Promise<PaymentRequest | null> {
  const row = await getRow(id);
  return row ? mapRow(row) : null;
}

export async function getPaymentByToken(token: string): Promise<PaymentRequest | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("payment_requests").select("*").eq("public_token", token).maybeSingle();
  return data ? mapRow(data as Row) : null;
}

export async function paymentsForAppointments(ids: string[]): Promise<Map<string, PaymentRequest[]>> {
  const map = new Map<string, PaymentRequest[]>();
  if (!ids.length) return map;
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select("*")
    .in("appointment_id", [...new Set(ids)])
    .order("created_at");
  for (const row of (data ?? []) as Row[]) {
    const p = mapRow(row);
    map.set(p.appointmentId!, [...(map.get(p.appointmentId!) ?? []), p]);
  }
  return map;
}

export async function paymentsForCustomer(customerId: string): Promise<PaymentRequest[]> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as Row[]).map(mapRow);
}

/** Open payments, newest first: what the team can take by Tap to Pay in the app. Monthly plans are left out. */
export async function openPaymentRequests(limit = 50): Promise<PaymentRequest[]> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select("*")
    .eq("status", "open")
    .is("plan_status", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapRow);
}

/**
 * The call-out fee already paid on this visit and not yet taken off an
 * invoice: the site's promise is that it comes off the repair.
 */
export async function calloutCreditFor(appointmentId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select("kind, status, amount_pence, lines")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelled");
  const rows = (data ?? []) as Pick<Row, "kind" | "status" | "amount_pence" | "lines">[];
  const paidFees = rows.filter((r) => r.kind === "callout_fee" && r.status === "paid").reduce((sum, r) => sum + r.amount_pence, 0);
  const credited = rows
    .filter((r) => r.kind === "invoice")
    .flatMap((r) => r.lines ?? [])
    .filter((l) => l.amount_pence < 0 && /call-out/i.test(l.description))
    .reduce((sum, l) => sum - l.amount_pence, 0);
  return Math.max(0, paidFees - credited);
}

// ---------------------------------------------------------------------------
// The saved card.

export type SavedCard = { customer: string; paymentMethod: string; brand: string; last4: string; expires: string };

/** The card the customer saved with MPE (ticked "save my card" when paying). Null when there's none. */
export async function savedCardFor(customer: Pick<Customer, "id">): Promise<SavedCard | null> {
  const { data } = await createAdminClient().from("customers").select("stripe_customer_id").eq("id", customer.id).maybeSingle();
  const stripeCustomer = (data?.stripe_customer_id as string | null) ?? null;
  if (!stripeCustomer) return null;
  try {
    const { data: methods } = await stripe.customers.listPaymentMethods(stripeCustomer, { type: "card", limit: 5 });
    const card = methods.find((m) => m.card && (m.card.exp_year > new Date().getFullYear() || (m.card.exp_year === new Date().getFullYear() && m.card.exp_month >= new Date().getMonth() + 1)));
    if (!card?.card) return null;
    return {
      customer: stripeCustomer,
      paymentMethod: card.id,
      brand: card.card.brand.charAt(0).toUpperCase() + card.card.brand.slice(1),
      last4: card.card.last4,
      expires: `${String(card.card.exp_month).padStart(2, "0")}/${String(card.card.exp_year).slice(-2)}`,
    };
  } catch (err) {
    console.error("payments: couldn't read saved card", err);
    return null;
  }
}

/** The customer in Stripe, made the first time they save a card. */
export async function stripeCustomerFor(customer: Customer): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("stripe_customer_id").eq("id", customer.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  const created = await stripe.customers.create(
    {
      ...(customer.email ? { email: customer.email } : {}),
      ...(customer.name ? { name: customer.name } : {}),
      ...(customer.phoneE164 ? { phone: customer.phoneE164 } : {}),
      metadata: { customer_id: customer.id },
    },
    { idempotencyKey: `mpe-customer-${customer.id}` },
  );
  await admin.from("customers").update({ stripe_customer_id: created.id }).eq("id", customer.id).is("stripe_customer_id", null);
  return created.id;
}

// ---------------------------------------------------------------------------
// Asking for payment.

export function parseLines(raw: unknown): { ok: true; lines: PaymentLine[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Add what it's for." };
  const lines: PaymentLine[] = [];
  for (const item of raw.slice(0, MAX_LINES)) {
    const description = String((item as { description?: unknown })?.description ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
    const amountPence = Math.round(Number((item as { amountPence?: unknown })?.amountPence));
    if (!description && !amountPence) continue;
    if (!description) return { ok: false, error: "Each line needs a description." };
    if (!Number.isFinite(amountPence) || amountPence === 0) return { ok: false, error: `Add an amount for "${description}".` };
    lines.push({ description, amountPence });
  }
  if (!lines.length) return { ok: false, error: "Add at least one line." };
  const total = lines.reduce((sum, l) => sum + l.amountPence, 0);
  if (total < MIN_TOTAL_PENCE) return { ok: false, error: `The total needs to be at least ${formatPence(MIN_TOTAL_PENCE)}.` };
  if (total > MAX_TOTAL_PENCE) return { ok: false, error: `The total can't be over ${formatPence(MAX_TOTAL_PENCE)}.` };
  return { ok: true, lines };
}

/** " You can also add a boiler service while we're here for £63 (usually £79)." */
export function offerLine(p: Pick<PaymentRequest, "offers" | "status">): string {
  const open = p.offers.filter((o) => !o.taken);
  if (!open.length || p.status !== "open") return "";
  const each = open.map((o) => `${lowerFirst(o.label)} for ${formatPence(o.pence)}${o.usualPence ? ` (usually ${formatPence(o.usualPence)})` : ""}`);
  return ` While we're with you, you can also add ${each.join(" or ")}: just tick it when you pay.`;
}

function lowerFirst(text: string): string {
  // "Boiler service" → "boiler service"; leaves "CO alarm" alone.
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** What the customer's told: "Invoice MPE-1002 for your boiler repair: £130. Pay here: …" */
function requestMessage(p: PaymentRequest, customer: Customer): string {
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  const what = p.kind === "callout_fee" ? `here's the link for your ${formatPence(p.amountPence)} call-out fee` : `here's invoice ${invoiceNumber(p.number)} for ${p.description.charAt(0).toLowerCase()}${p.description.slice(1)}: ${formatPence(p.amountPence)}`;
  return `${hi}${what}.${offerLine(p)}${monthlyLine(p)} Pay by Apple Pay, Google Pay or card: ${payLink(p)}`;
}

/** " Or spread the cost, interest-free: £250 today, then £200 a month for 9 months." */
export function monthlyLine(p: Pick<PaymentRequest, "instalments" | "planStatus" | "status" | "amountPence">): string {
  if (!p.instalments || p.planStatus || p.status !== "open") return "";
  const plan = instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence);
  return plan.ok ? ` Or spread the cost, interest-free: ${scheduleSummary(plan.schedule, formatPence)}.` : "";
}

const partPaidMonthly = "This one's being paid monthly: record what they pay under its monthly payments.";

/** Being paid monthly: nothing else may take the money for it, or cancel it, until that stops. */
function onMonthly(row: Pick<Row, "plan_status">): string | null {
  return row.plan_status === "active" || row.plan_status === "past_due" ? "They're paying this monthly. Stop the monthly payments first." : null;
}

/**
 * Saves a call-out fee or an invoice and, unless `send` is off, sends it
 * to the customer (chat card, text, email, app). With a saved card and
 * `chargeNow`, the card's charged first: it arrives already paid, or open
 * to pay if the charge didn't go through.
 */
export async function createPaymentRequest(params: {
  /** Who asked for it; none for one the customer started (a quote's deposit). */
  staffId: string | null;
  customerId: string;
  appointmentId?: string | null;
  kind: PaymentKind;
  description: string;
  lines: PaymentLine[];
  send?: boolean;
  chargeNow?: boolean;
  /** Up to two add-ons to offer on their pay page. */
  offers?: Omit<PaymentOffer, "taken">[];
  /** Let them pay it monthly instead: over this many payments, with any deposit taken first. */
  instalments?: { months: number; depositPence: number } | null;
  /** A quote's deposit, or the invoice for the rest of a quote (lib/quotes.ts). */
  quoteId?: string | null;
}): Promise<{ ok: true; request: PaymentRequest; sentVia: string[]; charge?: ChargeResult } | { ok: false; error: string }> {
  const customer = await getCustomer(params.customerId);
  if (!customer) return { ok: false, error: "Customer not found." };
  const description = params.description.trim().replace(/\s+/g, " ").slice(0, 120) || "Your job";
  const amountPence = params.lines.reduce((sum, l) => sum + l.amountPence, 0);
  if (amountPence < MIN_TOTAL_PENCE || amountPence > MAX_TOTAL_PENCE) return { ok: false, error: "Check the amounts." };
  if (params.instalments) {
    const plan = instalmentSchedule(amountPence, params.instalments.months, params.instalments.depositPence);
    if (!plan.ok) return { ok: false, error: plan.error };
  }

  const { data, error } = await createAdminClient()
    .from("payment_requests")
    .insert({
      customer_id: customer.id,
      conversation_id: customer.conversationId,
      appointment_id: params.appointmentId ?? null,
      kind: params.kind,
      description,
      lines: params.lines.map((l) => ({ description: l.description, amount_pence: l.amountPence })),
      amount_pence: amountPence,
      created_by: params.staffId,
      offers: (params.offers ?? [])
        .filter((o) => o.pence > 0 && o.label.trim())
        .slice(0, MAX_OFFERS)
        .map((o) => ({ product_id: o.productId, label: o.label.trim().slice(0, 80), pence: o.pence, usual_pence: o.usualPence, taken: false })),
      ...(params.quoteId ? { quote_id: params.quoteId } : {}),
      ...(params.instalments && params.kind === "invoice"
        ? { instalments: params.instalments.months, instalment_deposit_pence: Math.max(0, Math.round(params.instalments.depositPence)) }
        : {}),
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("payments: create failed", error);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  let request = mapRow(data as Row);
  const charge = params.chargeNow ? await chargeSavedCard(request.id) : undefined;
  if (charge?.ok) request = (await getPaymentRequest(request.id)) ?? request;

  const sentVia =
    params.send === false
      ? []
      : await deliverToCustomer(customer, {
          body:
            request.status === "paid"
              ? `${customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, "}thanks, ${formatPence(request.amountPence)} paid by your saved card for ${request.kind === "callout_fee" ? "your call-out" : `invoice ${invoiceNumber(request.number)}`}. Your receipt: ${payLink(request)}`
              : requestMessage(request, customer),
          headline: request.kind === "callout_fee" ? "Your call-out fee" : `Invoice ${invoiceNumber(request.number)}`,
          staffId: params.staffId,
          pushHref: `/pay/${request.publicToken}`,
          paymentRequestId: request.id,
          emailHtml: () => invoiceEmailHtml({ request, name: customer.name, link: payLink(request) }),
        });
  return { ok: true, request, sentVia, ...(charge ? { charge } : {}) };
}

// ---------------------------------------------------------------------------
// Paying.

/** Stripe Checkout for the pay page: Apple Pay, Google Pay or card, and the tick to save the card. */
export async function checkoutUrl(id: string, opts: { saveCard: boolean; addOffers?: number[]; returnTo?: string }): Promise<{ url: string } | { error: string }> {
  const row = await getRow(id);
  if (!row) return { error: "Payment not found." };
  if (row.status !== "open") return { error: row.status === "paid" ? "That's already paid. Thank you!" : "That payment was cancelled." };
  if (row.plan_status) return { error: "You're paying this monthly: pay something off from the monthly payments section instead." };
  const customer = row.customer_id ? await getCustomer(row.customer_id) : null;
  const stripeCustomer = opts.saveCard && customer ? await stripeCustomerFor(customer) : null;
  const link = payLink(mapRow(row));
  const name = row.kind === "callout_fee" ? `${business.name} call-out fee` : `${business.name} invoice ${invoiceNumber(row.number)}`;
  // They ticked the add-on: it's a second line, and recorded once they've paid.
  const picked = [...new Set(opts.addOffers ?? [])].filter((i) => Number.isInteger(i) && (row.offers ?? [])[i] && !(row.offers ?? [])[i].taken);
  const offers = picked.map((i) => (row.offers ?? [])[i]);
  const total = row.amount_pence + offers.reduce((sum, o) => sum + o.pence, 0);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      { quantity: 1, price_data: { currency: "gbp", unit_amount: row.amount_pence, product_data: { name, description: row.description } } },
      ...offers.map((o) => ({ quantity: 1, price_data: { currency: "gbp", unit_amount: o.pence, product_data: { name: o.label } } })),
    ],
    ...(stripeCustomer ? { customer: stripeCustomer } : customer?.email ? { customer_email: customer.email } : {}),
    payment_intent_data: {
      ...paymentFee(total),
      description: `${name}: ${row.description}${offers.map((o) => ` + ${o.label}`).join("")}`,
      ...(customer?.email ? { receipt_email: customer.email } : {}),
      // They ticked "save my card": kept for Fergal to charge at a future
      // visit, when they say so.
      ...(stripeCustomer ? { setup_future_usage: "off_session" as const } : {}),
      metadata: { payment_request_id: row.id, via: "link", ...(picked.length ? { add_offers: picked.join(",") } : {}) },
    },
    metadata: { kind: "payment_request", payment_request_id: row.id },
    success_url: `${opts.returnTo ?? link}?paid=1`,
    cancel_url: opts.returnTo ?? link,
  });
  if (!session.url) return { error: "Couldn't start the payment." };
  return { url: session.url };
}

export type ChargeResult = { ok: true } | { ok: false; error: string };

/**
 * Charges the card the customer saved, when Fergal's with them and they've
 * said yes. Claimed first so two taps can't both charge. If their bank
 * wants them to approve it, it stays open for them to pay from the link.
 */
export async function chargeSavedCard(id: string): Promise<ChargeResult> {
  const admin = createAdminClient();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Payment not found." };
  if (row.status !== "open") return { ok: false, error: row.status === "paid" ? "That's already paid." : "That payment was cancelled." };
  if (row.plan_status) return { ok: false, error: onMonthly(row) ?? partPaidMonthly };
  const card = row.customer_id ? await savedCardFor({ id: row.customer_id }) : null;
  if (!card) return { ok: false, error: "They haven't saved a card with MPE. They can pay from the link instead." };

  const claimedAt = new Date().toISOString();
  const { data: claimed } = await admin
    .from("payment_requests")
    .update({ charging_at: claimedAt })
    .eq("id", row.id)
    .eq("status", "open")
    .or(`charging_at.is.null,charging_at.lt.${new Date(Date.now() - 2 * 60_000).toISOString()}`)
    .select("id");
  if (!claimed?.length) return { ok: false, error: "It's already being charged, or has just been paid. Give it a moment." };
  const release = () => admin.from("payment_requests").update({ charging_at: null }).eq("id", row.id).eq("charging_at", claimedAt);
  const customer = row.customer_id ? await getCustomer(row.customer_id) : null;

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: row.amount_pence,
        currency: "gbp",
        ...paymentFee(row.amount_pence),
        customer: card.customer,
        payment_method: card.paymentMethod,
        off_session: true,
        confirm: true,
        description: `${row.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(row.number)}`}: ${row.description}`,
        ...(customer?.email ? { receipt_email: customer.email } : {}),
        metadata: { payment_request_id: row.id, via: "saved_card" },
      },
      { idempotencyKey: `mpe-pay-${row.id}-${claimedAt}` },
    );
    if (intent.status !== "succeeded") {
      await release();
      return { ok: false, error: "Not charged: their bank wants them to approve it. They can pay from the link instead." };
    }
    await markPaid(row.id, intent.id, "saved_card");
    return { ok: true };
  } catch (err) {
    await release();
    const message = err instanceof Error ? err.message : "";
    console.error("payments: saved card charge failed", row.id, message);
    return {
      ok: false,
      error: /authentic/i.test(message)
        ? "Not charged: their bank wants them to approve it. They can pay from the link instead."
        : "The card was declined. They can pay from the link with another card.",
    };
  }
}

/**
 * Tap to Pay on Fergal's phone (the MPE app, with the Stripe Terminal SDK):
 * a card-present payment the app collects and confirms on the phone. The
 * webhook marks it paid like any other.
 */
export async function tapToPayIntent(id: string): Promise<{ clientSecret: string; amountPence: number } | { error: string }> {
  const row = await getRow(id);
  if (!row) return { error: "Payment not found." };
  if (row.status !== "open") return { error: row.status === "paid" ? "That's already paid." : "That payment was cancelled." };
  if (row.plan_status) return { error: onMonthly(row) ?? partPaidMonthly };
  const intent = await stripe.paymentIntents.create({
    amount: row.amount_pence,
    currency: "gbp",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    ...paymentFee(row.amount_pence),
    description: `${row.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(row.number)}`}: ${row.description}`,
    metadata: { payment_request_id: row.id, via: "tap_to_pay" },
  });
  if (!intent.client_secret) return { error: "Couldn't start the payment." };
  return { clientSecret: intent.client_secret, amountPence: row.amount_pence };
}

/** A connection token for the app's Stripe Terminal SDK (Tap to Pay). */
export async function terminalConnectionToken(): Promise<string> {
  const location = process.env.STRIPE_TERMINAL_LOCATION || undefined;
  const token = await stripe.terminal.connectionTokens.create(location ? { location } : {});
  return token.secret;
}

/** Paid with Fergal another way: another card machine, cash or bank transfer. */
export async function markPaidInPerson(id: string, via: "in_person" | "cash" | "bank_transfer"): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_via: via, charging_at: null })
    .eq("id", id)
    .eq("status", "open")
    .is("plan_status", null)
    .select("id, customer_id");
  if (data?.length) {
    if (data[0].customer_id) await rewardReferral(data[0].customer_id as string);
    return { ok: true };
  }
  const row = await getRow(id);
  return { ok: false, error: !row ? "Payment not found." : row.status === "paid" ? "That's already paid." : row.plan_status ? partPaidMonthly : "That payment was cancelled." };
}

/**
 * A Stripe payment went through (the webhook, or a saved card charge here):
 * marks it paid once and tells the team. A payment for one already paid
 * another way, or cancelled, is refunded.
 */
export async function markPaid(id: string, paymentIntentId: string, via: PaidVia, opts: { offersTaken?: number[] } = {}): Promise<void> {
  const admin = createAdminClient();
  // The add-ons they ticked join the invoice: a line each, and the total.
  const before = opts.offersTaken?.length ? await getRow(id) : null;
  const taken = before && before.status === "open" ? opts.offersTaken!.filter((i) => (before.offers ?? [])[i] && !(before.offers ?? [])[i].taken) : [];
  const offer =
    before && taken.length
      ? {
          offers: (before.offers ?? []).map((o, i) => (taken.includes(i) ? { ...o, taken: true } : o)),
          lines: [...(before.lines ?? []), ...taken.map((i) => ({ description: before.offers![i].label, amount_pence: before.offers![i].pence }))],
          amount_pence: before.amount_pence + taken.reduce((sum, i) => sum + before.offers![i].pence, 0),
        }
      : {};
  const { data: updated, error } = await admin
    .from("payment_requests")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_via: via, stripe_payment_intent_id: paymentIntentId, charging_at: null, ...offer })
    .eq("id", id)
    .eq("status", "open")
    .select("*");
  // Thrown, not skipped: the webhook answers 500 and Stripe sends it again.
  if (error) throw new Error(`payments: couldn't mark ${id} paid: ${error.message}`);
  const row = (updated?.[0] as Row | undefined) ?? null;

  if (!row) {
    const current = await getRow(id);
    if (!current) throw new Error(`payments: couldn't read ${id} after a payment`);
    if (current.stripe_payment_intent_id === paymentIntentId) return;
    if (current.status === "open") throw new Error(`payments: ${id} still open after a payment`);
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      await stripe.refunds.create(
        { payment_intent: paymentIntentId, ...(intent.application_fee_amount ? { refund_application_fee: true } : {}) },
        { idempotencyKey: `mpe-refund-${paymentIntentId}` },
      );
      console.warn("payments: refunded a second payment", id, paymentIntentId, current.status);
    } catch (err) {
      console.error("payments: couldn't refund a second payment", id, paymentIntentId, err);
      await alertTeam("Payment needs refunding", `${formatPence(current.amount_pence)} came in for ${current.description}, which was already ${current.status}, and couldn't be refunded automatically. Refund it in Stripe.`);
    }
    return;
  }

  // Their first job paid, through someone's referral link: the referrer's thanked.
  if (row.customer_id) await rewardReferral(row.customer_id);

  // A quote's deposit: the quote's accepted (and the team told there).
  if (row.quote_id && row.kind === "other") {
    const { quoteDepositPaid } = await import("@/lib/quotes");
    await quoteDepositPaid(row.quote_id);
  }

  const customer = row.customer_id ? await getCustomer(row.customer_id) : null;
  const added = taken.map((i) => (row.offers ?? [])[i]).filter(Boolean);
  if (added.length) {
    await alertTeam(
      added.length === 1 ? `${added[0].label} added` : "Extras added",
      `${customer?.name || "The customer"} added ${added.map((o) => `${lowerFirst(o.label)} (${formatPence(o.pence)})`).join(" and ")} and has paid. Do it while you're there.`,
    );
  }
  await alertTeam(
    "Payment received",
    `${formatPence(row.amount_pence)} from ${customer?.name || customer?.email || "a customer"}: ${row.kind === "callout_fee" ? "call-out fee" : invoiceNumber(row.number)} (${PAID_VIA_LABEL[via]}).`,
  );
}

export async function cancelPaymentRequest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open")
    .or("plan_status.is.null,plan_status.in.(completed,stopped)")
    .select("id");
  if (data?.length) return { ok: true };
  const row = await getRow(id);
  return {
    ok: false,
    error: !row ? "Payment not found." : row.status === "paid" ? "That's already paid: refund it in Stripe instead." : (onMonthly(row) ?? "It's already cancelled."),
  };
}

/** Referrals are rewarded on a customer's first paid job (lib/referrals.ts); never in the way of a payment. */
async function rewardReferral(customerId: string): Promise<void> {
  try {
    const { rewardReferralFor } = await import("@/lib/referrals");
    await rewardReferralFor(customerId);
  } catch (err) {
    console.error("payments: referral reward failed", err);
  }
}

export async function alertTeam(title: string, body: string): Promise<void> {
  try {
    await pushToUsers(await chatRecipientIds(), { title, body, data: { kind: "link", href: "/staff/schedule" } });
  } catch (err) {
    console.error("payments: team alert failed", err);
  }
}

/** The Stripe webhook's part: a payment for a payment request succeeded. True when it was one. */
export async function handlePaymentIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const id = intent.metadata?.payment_request_id;
  if (!id) return false;
  const via = (["app", "saved_card", "tap_to_pay"] as const).find((v) => v === intent.metadata?.via) ?? "link";
  const offersTaken = (intent.metadata?.add_offers ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < MAX_OFFERS);
  await markPaid(id, intent.id, via, { offersTaken });
  return true;
}


/** A receipt for a payment taken in person: in their conversation and by email, like everything else. */
export async function sendReceipt(id: string, staffId: string | null): Promise<string[]> {
  const p = await getPaymentRequest(id);
  const customer = p?.customerId ? await getCustomer(p.customerId) : null;
  if (!p || !customer || p.status !== "paid") return [];
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  return deliverToCustomer(customer, {
    body: `${hi}thanks, ${formatPence(p.amountPence)} paid${p.paidVia ? ` (${PAID_VIA_LABEL[p.paidVia]})` : ""} for ${p.kind === "callout_fee" ? "your call-out" : `invoice ${invoiceNumber(p.number)}`}. Your receipt: ${payLink(p)}`,
    headline: p.kind === "callout_fee" ? "Call-out fee paid" : `Invoice ${invoiceNumber(p.number)} paid`,
    staffId,
    pushHref: `/pay/${p.publicToken}`,
    paymentRequestId: p.id,
    emailHtml: () => invoiceEmailHtml({ request: p, name: customer.name, link: payLink(p) }),
  });
}

/** Sends the link again (Fergal's "Send again"). */
export async function resendPaymentLink(id: string, staffId: string): Promise<string[]> {
  const p = await getPaymentRequest(id);
  const customer = p?.customerId ? await getCustomer(p.customerId) : null;
  if (!p || !customer || p.status !== "open" || p.planStatus) return [];
  return deliverToCustomer(customer, {
    body: requestMessage(p, customer),
    headline: p.kind === "callout_fee" ? "Your call-out fee" : `Invoice ${invoiceNumber(p.number)}`,
    staffId,
    pushHref: `/pay/${p.publicToken}`,
    paymentRequestId: p.id,
    emailHtml: () => invoiceEmailHtml({ request: p, name: customer.name, link: payLink(p) }),
  });
}

/** "Still to pay" for an invoice left open: the sweep's unpaid reminders (lib/follow-up-sweep.ts). */
export async function sendUnpaidReminder(id: string): Promise<string[]> {
  const p = await getPaymentRequest(id);
  const customer = p?.customerId ? await getCustomer(p.customerId) : null;
  if (!p || !customer || p.status !== "open" || p.planStatus) return [];
  const hi = customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, ";
  const what = p.kind === "callout_fee" ? `your ${formatPence(p.amountPence)} call-out fee` : `invoice ${invoiceNumber(p.number)} (${formatPence(p.amountPence)})`;
  return deliverToCustomer(customer, {
    body: `${hi}a quick reminder that ${what} is still to pay. Pay by Apple Pay, Google Pay or card: ${payLink(p)} Already paid? Just reply and we'll sort it.`,
    headline: p.kind === "callout_fee" ? "Your call-out fee" : `Invoice ${invoiceNumber(p.number)}`,
    staffId: null,
    pushHref: `/pay/${p.publicToken}`,
    paymentRequestId: p.id,
    emailHtml: () => invoiceEmailHtml({ request: p, name: customer.name, link: payLink(p) }),
  });
}
