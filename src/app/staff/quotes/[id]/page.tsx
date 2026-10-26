import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { customerLabel, getCustomer } from "@/lib/customers";
import { longDate } from "@/lib/day-plan";
import { formatPence, getPaymentRequest, invoiceNumber, payLink } from "@/lib/payments";
import { QUOTE_STATUS_LABEL, getQuote, quoteLink, quoteNumber, quoteOpen } from "@/lib/quotes";
import { londonNow, formatLondonClock, londonParts } from "@/lib/schedule-time";
import { manageQuote } from "../actions";

export const metadata: Metadata = { title: "Quote" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (iso: string) => {
  const { day, month } = londonParts(iso);
  return `${day} ${MONTHS[month]}, ${formatLondonClock(iso)}`;
};
const BUTTON = "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-foreground/40";

/**
 * One quote for the team: what was sent, where it's got to (sent, looked
 * at, followed up, accepted with the deposit, or declined and why), and
 * what to do next: send it again, withdraw it, book the work, or invoice
 * the rest once it's done.
 */
export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params;
  const { done } = await searchParams;
  await requireStaff(`/staff/quotes/${id}`);
  const quote = await getQuote(id);
  if (!quote) notFound();
  const [customer, deposit, balance] = await Promise.all([
    getCustomer(quote.customerId),
    quote.depositRequestId ? getPaymentRequest(quote.depositRequestId) : Promise.resolve(null),
    quote.balanceRequestId ? getPaymentRequest(quote.balanceRequestId) : Promise.resolve(null),
  ]);
  const today = londonNow().dateISO;
  const open = quoteOpen(quote);

  const timeline = [
    quote.sentAt && `Sent ${when(quote.sentAt)}`,
    quote.viewedAt && `Opened ${when(quote.viewedAt)}`,
    quote.followupCount > 0 && `Followed up ${quote.followupCount === 1 ? "once" : "twice"}`,
    quote.acceptedAt && `Accepted ${when(quote.acceptedAt)}${deposit?.status === "paid" ? `, deposit paid` : ""}`,
    quote.declinedAt && `Declined ${when(quote.declinedAt)}${quote.declineReason ? `: "${quote.declineReason}"` : ""}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/staff/quotes" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Quotes
      </Link>
      <p className="mt-6 text-sm uppercase tracking-widest text-muted">
        Quote {quoteNumber(quote.number)} · {quote.status === "sent" && quote.validUntil < today ? "Ran out" : QUOTE_STATUS_LABEL[quote.status]}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{quote.title}</h1>
      {customer && (
        <Link href={`/staff/customers/${customer.id}#quotes`} className="mt-1 inline-flex min-h-9 items-center text-muted underline-offset-4 hover:underline">
          {customerLabel(customer)}
        </Link>
      )}
      {done && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success" data-flash>{done}</p>}

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-label="The quote">
        <ul className="flex flex-col divide-y divide-border text-sm">
          {quote.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span>{l.description}</span>
              <span className="font-semibold">{formatPence(l.amountPence)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-bold">
          <span>Total</span>
          <span>{formatPence(quote.totalPence)}</span>
        </p>
        {quote.depositPence > 0 && (
          <p className="mt-1 text-sm text-muted">
            {formatPence(quote.depositPence)} deposit to accept, {formatPence(quote.totalPence - quote.depositPence)} when it&rsquo;s done
            {quote.balanceInstalments ? `, which they can pay over ${quote.balanceInstalments} months` : ""}.
          </p>
        )}
        {!quote.depositPence && quote.balanceInstalments && <p className="mt-1 text-sm text-muted">They can pay it over {quote.balanceInstalments} months once it&rsquo;s done.</p>}
        {quote.details && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{quote.details}</p>}
        <p className="mt-3 text-xs text-muted">Open until {longDate(quote.validUntil)}.</p>
      </section>

      {timeline.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 text-sm text-muted" data-quote-timeline>
          {timeline.map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
      )}

      <form action={manageQuote.bind(null, quote.id)} className="mt-6 flex flex-wrap gap-2">
        {open && (
          <button type="submit" name="intent" value="resend" className={BUTTON}>
            Send it again
          </button>
        )}
        {quote.status === "accepted" && !quote.balanceRequestId && (
          <>
            <Link href={`/staff/schedule?view=day&date=${today}&customer=${quote.customerId}#add`} className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90">
              Book the work in
            </Link>
            <button type="submit" name="intent" value="invoice" className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
              Work done: invoice the rest
            </button>
          </>
        )}
        <a href={quoteLink(quote)} target="_blank" rel="noopener noreferrer" className={BUTTON}>
          Their quote page
        </a>
        {quote.status === "sent" && (
          <button type="submit" name="intent" value="cancel" className="min-h-11 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/10">
            Withdraw it
          </button>
        )}
      </form>

      {(deposit || balance) && (
        <section className="mt-6" aria-label="Payments">
          <ul className="flex flex-col gap-2 text-sm">
            {[deposit, balance].filter((p): p is NonNullable<typeof p> => !!p).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3">
                <span>
                  <span className="font-semibold">{p.id === quote.depositRequestId ? "Deposit" : `Invoice ${invoiceNumber(p.number)}`}</span> {formatPence(p.amountPence)}
                </span>
                <a href={payLink(p)} target="_blank" rel="noopener noreferrer" className={`text-xs font-semibold underline underline-offset-4 ${p.status === "paid" ? "text-success" : "text-muted"}`}>
                  {p.status === "paid" ? "Paid ✓ receipt" : p.planStatus ? "Paying monthly" : "Waiting"}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
