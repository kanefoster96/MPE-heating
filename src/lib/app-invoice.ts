import { getAppointment } from "@/lib/appointments";
import { customerLabel, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { MAX_INSTALMENTS, MIN_INSTALMENTS } from "@/lib/instalment-schedule";
import { planFor } from "@/lib/maintenance-plan";
import {
  CALLOUT_FEE_PENCE,
  MAX_OFFERS,
  calloutCreditFor,
  createPaymentRequest,
  formatPence,
  parseLines,
  paymentsForAppointments,
  paymentsForCustomer,
  paymentsOn,
  savedCardFor,
} from "@/lib/payments";
import { listProducts, upsellProducts } from "@/lib/products";
import { availableCredits, spendCredits } from "@/lib/referrals";
import { viaPhrase } from "@/lib/visit-notify";

/**
 * A new invoice or call-out fee in the app (mobile/app/new-payment.tsx):
 * the website's /staff/payments/new. The call-out fee (unless they're on
 * the plan or one's been asked for), and the invoice builder: lines, his
 * products as one-tap lines, the call-out fee they paid taken off, money
 * they're owed from a referral, extras offered on their pay page, and
 * paying monthly. Saved by createPaymentRequest, as the website does. Then
 * either sent to them, or kept to take there and then on the Payment sheet.
 */

export async function invoiceContext(params: { visitId?: string | null; customerId?: string | null }) {
  const visit = params.visitId ? await getAppointment(params.visitId) : null;
  const customer = visit?.customerId ? await getCustomer(visit.customerId) : params.customerId ? await getCustomer(params.customerId) : null;
  if (!customer) return null;
  const online = paymentsOn();
  const [existing, card, credit, plan, products, upsells, credits] = await Promise.all([
    visit ? paymentsForAppointments([visit.id]).then((m) => m.get(visit.id) ?? []) : paymentsForCustomer(customer.id),
    online ? savedCardFor(customer) : Promise.resolve(null),
    visit ? calloutCreditFor(visit.id) : Promise.resolve(0),
    planFor(customer.id).catch(() => null),
    listProducts().catch(() => []),
    upsellProducts().catch(() => []),
    availableCredits(customer.id).catch(() => []),
  ]);
  const onPlan = plan && (plan.status === "active" || plan.status === "past_due");
  const calloutAsked = !!visit && existing.some((p) => p.kind === "callout_fee" && p.status !== "cancelled");
  return {
    customer: { id: customer.id, name: customerLabel(customer), first: customer.name?.split(" ")[0] ?? null },
    visit: visit ? { id: visit.id, label: `${KIND_LABEL[visit.kind]} · ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}` } : null,
    online,
    savedCard: card ? { brand: card.brand, last4: card.last4 } : null,
    onPlan: onPlan ? `On the maintenance plan: no call-out fee${visit?.kind === "service" ? ", and their yearly service is included" : ""}.` : null,
    callout: !calloutAsked && !onPlan ? { pence: CALLOUT_FEE_PENCE, label: formatPence(CALLOUT_FEE_PENCE) } : null,
    creditPence: credit,
    defaultDescription: visit ? (visit.kind === "callout" || visit.kind === "repair" ? "Boiler repair" : KIND_LABEL[visit.kind]) : "",
    repair: !visit || visit.kind === "callout" || visit.kind === "repair",
    products: products.map((p) => ({ id: p.id, name: p.name, pricePence: p.pricePence })),
    upsells: upsells.map((u) => ({ productId: u.id, label: u.name, usualPence: u.pricePence, offerPence: u.offerPence })),
    credits: credits.map((c) => ({ id: c.id, label: c.reason, pence: c.amountPence })),
    months: { min: MIN_INSTALMENTS, max: MAX_INSTALMENTS },
  };
}

export type InvoiceBody = {
  customerId?: string;
  appointmentId?: string | null;
  kind?: "callout_fee" | "invoice";
  description?: string;
  lines?: { description: string; amountPence: number }[];
  /** "send": to them, with the link. "take": kept, to take now on the Payment sheet. */
  intent?: "send" | "take";
  offers?: { productId: string | null; label: string; pence: number; usualPence: number | null }[];
  instalments?: { months: number; depositPence: number } | null;
  creditIds?: string[];
};

export async function createInvoice(body: InvoiceBody, staffId: string): Promise<{ ok: true; id: string; message: string } | { ok: false; error: string }> {
  if (typeof body.customerId !== "string") return { ok: false, error: "Pick the customer." };
  const kind = body.kind === "callout_fee" ? "callout_fee" : "invoice";
  const send = body.intent !== "take";
  const lines = kind === "callout_fee" ? { ok: true as const, lines: [{ description: "Call-out fee", amountPence: CALLOUT_FEE_PENCE }] } : parseLines(body.lines);
  if (!lines.ok) return { ok: false, error: lines.error };
  const offers =
    kind === "invoice"
      ? (body.offers ?? [])
          .slice(0, MAX_OFFERS)
          .map((o) => ({
            productId: typeof o.productId === "string" ? o.productId : null,
            label: String(o.label ?? "").trim().slice(0, 80),
            pence: Math.round(Number(o.pence)),
            usualPence: Number.isFinite(Number(o.usualPence)) && Number(o.usualPence) > Number(o.pence) ? Math.round(Number(o.usualPence)) : null,
          }))
          .filter((o) => o.label && Number.isFinite(o.pence) && o.pence >= 100)
      : [];
  const months = Number(body.instalments?.months);
  const instalments =
    kind === "invoice" && send && Number.isInteger(months) && months >= MIN_INSTALMENTS
      ? { months, depositPence: Math.max(0, Math.round(Number(body.instalments?.depositPence) || 0)) }
      : null;
  const created = await createPaymentRequest({
    staffId,
    customerId: body.customerId,
    appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
    kind,
    description: kind === "callout_fee" ? "Call-out fee" : String(body.description ?? ""),
    lines: lines.lines,
    send,
    offers,
    instalments,
  });
  if (!created.ok) return { ok: false, error: created.error };
  // Money off they were owed, now on this invoice: used.
  if (kind === "invoice" && body.creditIds?.length) await spendCredits(body.customerId, body.creditIds.filter((x) => typeof x === "string"), created.request.id);
  const message = !send
    ? "Saved. Take it now."
    : created.sentVia.length
      ? `Sent by ${viaPhrase(created.sentVia)}.`
      : "Saved, but we couldn't reach them: add an email or mobile to their details.";
  return { ok: true, id: created.request.id, message };
}
