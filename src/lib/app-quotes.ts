import { getAppointment, pendingForCustomer } from "@/lib/appointments";
import { customerLabel, getCustomer, getCustomers } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { formatPence, getPaymentRequest, invoiceNumber, paymentsOn } from "@/lib/payments";
import { listProducts } from "@/lib/products";
import { QUOTE_STATUS_LABEL, cancelQuote, createQuote, getQuote, invoiceBalance, listQuotes, quoteLink, quoteNumber, resendQuote } from "@/lib/quotes";
import { londonNow } from "@/lib/schedule-time";
import { viaPhrase } from "@/lib/visit-notify";

/**
 * Quotes in the app (mobile/app/quotes.tsx, new-quote.tsx, quote/[id].tsx):
 * the website's /staff/quotes. Waiting for them, accepted (to do), and the
 * last 90 days; writing one (lines, products, what's included, a deposit,
 * how long it's open, the rest monthly); and on one: send it again,
 * withdraw it, book the work in, invoice the rest. Through createQuote,
 * resendQuote, cancelQuote and invoiceBalance, as the website does.
 */

export const QUOTE_TABS = ["open", "accepted", "closed"] as const;
export type QuoteTab = (typeof QUOTE_TABS)[number];

export async function quoteList(tab: QuoteTab) {
  const quotes = await listQuotes(tab);
  const customers = await getCustomers(quotes.map((q) => q.customerId));
  const today = londonNow().dateISO;
  return {
    tab,
    count: quotes.length,
    total: formatPence(quotes.reduce((sum, q) => sum + q.totalPence, 0)),
    items: quotes.map((q) => {
      const c = customers.get(q.customerId);
      const ranOut = q.status === "sent" && q.validUntil < today;
      return {
        id: q.id,
        customer: c ? customerLabel(c) : "Customer",
        title: `${quoteNumber(q.number)} · ${q.title}`,
        amount: formatPence(q.totalPence),
        tone: q.status === "accepted" ? "good" : ranOut || q.status === "declined" ? "bad" : "plain",
        detail: q.status === "sent" ? (ranOut ? "Ran out" : `${q.viewedAt ? "Opened" : "Not opened yet"} · until ${longDate(q.validUntil).replace(/^\w+ /, "")}`) : QUOTE_STATUS_LABEL[q.status],
      };
    }),
  };
}

export async function quoteContext(params: { visitId?: string | null; customerId?: string | null }) {
  let visit = params.visitId ? await getAppointment(params.visitId) : null;
  const customer = visit?.customerId ? await getCustomer(visit.customerId) : params.customerId ? await getCustomer(params.customerId) : null;
  if (!customer) return null;
  // A repair agreed at their call-out and not booked yet: this is its price, so it's on that job.
  if (!visit) visit = (await pendingForCustomer(customer.id, londonNow().dateISO).catch(() => null))?.returnOf ?? null;
  const products = await listProducts().catch(() => []);
  return {
    customer: { id: customer.id, name: customerLabel(customer), first: customer.name?.split(" ")[0] ?? null },
    visit: visit ? { id: visit.id, label: `${KIND_LABEL[visit.kind]} · ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}` } : null,
    where: [customer.address, customer.postcode].filter(Boolean).join(", "),
    boiler: [customer.boilerMake, customer.boilerModel, customer.boilerAge].filter(Boolean).join(" · ") + (customer.boilerNotes ? ` · “${customer.boilerNotes}”` : ""),
    defaultTitle:
      visit?.kind === "install" || visit?.kind === "quote"
        ? "New boiler, supplied and fitted"
        : visit?.outcome === "return" && visit.returnNote
          ? `${visit.returnNote.charAt(0).toUpperCase()}${visit.returnNote.slice(1)}`
          : "",
    products: products.map((p) => ({ id: p.id, name: p.name, pricePence: p.pricePence })),
    online: paymentsOn(),
  };
}

export type QuoteBody = {
  customerId?: string;
  appointmentId?: string | null;
  title?: string;
  lines?: unknown;
  depositPence?: number;
  details?: string;
  validDays?: number;
  balanceInstalments?: number | null;
};

export async function sendNewQuote(body: QuoteBody, staffId: string): Promise<{ ok: true; id: string; message: string } | { ok: false; error: string }> {
  if (typeof body.customerId !== "string") return { ok: false, error: "Pick the customer." };
  const created = await createQuote({
    staffId,
    customerId: body.customerId,
    appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
    title: String(body.title ?? ""),
    lines: body.lines ?? [],
    depositPence: Math.max(0, Math.round(Number(body.depositPence) || 0)),
    details: String(body.details ?? ""),
    validDays: Number(body.validDays) || undefined,
    balanceInstalments: Number(body.balanceInstalments) || null,
  });
  if (!created.ok) return created;
  return { ok: true, id: created.quote.id, message: created.sentVia.length ? `Sent by ${viaPhrase(created.sentVia)}.` : "Saved, but we couldn't reach them: add an email or mobile to their details." };
}

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long" });

export async function quoteDetail(id: string) {
  const q = await getQuote(id);
  if (!q) return null;
  const [customer, deposit, balance] = await Promise.all([
    getCustomer(q.customerId),
    q.depositRequestId ? getPaymentRequest(q.depositRequestId) : Promise.resolve(null),
    q.balanceRequestId ? getPaymentRequest(q.balanceRequestId) : Promise.resolve(null),
  ]);
  const today = londonNow().dateISO;
  const when = (iso: string) => WHEN.format(new Date(iso));
  return {
    id: q.id,
    number: quoteNumber(q.number),
    title: q.title,
    status: q.status,
    statusLabel: q.status === "sent" && q.validUntil < today ? "Ran out" : QUOTE_STATUS_LABEL[q.status],
    customer: customer ? { id: customer.id, name: customerLabel(customer) } : null,
    lines: q.lines.map((l) => ({ description: l.description, amount: formatPence(l.amountPence) })),
    total: formatPence(q.totalPence),
    deposit: q.depositPence > 0 ? `${formatPence(q.depositPence)} deposit to accept, ${formatPence(q.totalPence - q.depositPence)} when it's done${q.balanceInstalments ? `, which they can pay over ${q.balanceInstalments} months` : ""}.` : q.balanceInstalments ? `They can pay it over ${q.balanceInstalments} months once it's done.` : null,
    details: q.details,
    validUntil: longDate(q.validUntil),
    timeline: [
      q.sentAt && `Sent ${when(q.sentAt)}`,
      q.viewedAt && `Opened ${when(q.viewedAt)}`,
      q.followupCount > 0 && `Followed up ${q.followupCount === 1 ? "once" : "twice"}`,
      q.acceptedAt && `Accepted ${when(q.acceptedAt)}${deposit?.status === "paid" ? ", deposit paid" : ""}`,
      q.declinedAt && `Declined ${when(q.declinedAt)}${q.declineReason ? `: “${q.declineReason}”` : ""}`,
    ].filter(Boolean) as string[],
    payments: [deposit, balance]
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ id: p.id, label: p.id === q.depositRequestId ? "Deposit" : `Invoice ${invoiceNumber(p.number)}`, amount: formatPence(p.amountPence), status: p.status === "paid" ? "Paid" : p.planStatus ? "Paying monthly" : "Waiting" })),
    canResend: q.status === "sent" && q.validUntil >= today,
    canCancel: q.status === "sent",
    toDo: q.status === "accepted" && !q.balanceRequestId,
    link: quoteLink(q),
  };
}

export const QUOTE_ACTIONS = ["resend", "cancel", "invoice"] as const;
export type QuoteAction = (typeof QUOTE_ACTIONS)[number];

export async function quoteAction(id: string, action: QuoteAction, staffId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (action === "resend") {
    const via = await resendQuote(id, staffId);
    return via.length ? { ok: true, message: `Sent again by ${viaPhrase(via)}.` } : { ok: false, error: "Couldn't send it: it may no longer be open, or we can't reach them." };
  }
  if (action === "cancel") return (await cancelQuote(id)) ? { ok: true, message: "Quote withdrawn." } : { ok: false, error: "Only an open quote can be withdrawn." };
  const result = await invoiceBalance(id, staffId);
  return result.ok ? { ok: true, message: `Invoice for the rest sent${result.sentVia.length ? ` by ${viaPhrase(result.sentVia)}` : ""}.` } : result;
}
