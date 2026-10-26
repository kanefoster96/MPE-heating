import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ContactOptions } from "@/components/ContactOptions";
import { PrintButton } from "@/components/PrintButton";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { enquiriesOn } from "@/lib/enquiries";
import { longDate } from "@/lib/day-plan";
import { formatPence, paymentsOn } from "@/lib/payments";
import { getQuoteByToken, markQuoteViewed, quoteNumber, quoteOpen } from "@/lib/quotes";
import { londonNow } from "@/lib/schedule-time";
import { acceptThisQuote, declineThisQuote } from "./actions";

export const metadata: Metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

/**
 * A quote, from the link in its message: what it's for, the lines, the
 * total, what's included and how long it's open, and Accept (paying the
 * deposit by Apple Pay, Google Pay or card, if there is one) or No thanks.
 * Prints cleanly. No sign-in: the link is private to them.
 */
export default async function CustomerQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; accepted?: string; declined?: string; error?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  if (!enquiriesOn()) notFound();
  const quote = await getQuoteByToken(token);
  if (!quote) notFound();
  await markQuoteViewed(quote.id);
  const customer = await getCustomer(quote.customerId);
  const open = quoteOpen(quote);
  const ranOut = quote.status === "sent" && quote.validUntil < londonNow().dateISO;
  const rest = quote.totalPence - quote.depositPence;
  const canPayDeposit = quote.depositPence > 0 ? paymentsOn() : true;

  return (
    <>
      <div className="print:hidden">
        <Nav />
      </div>
      <main className="bg-cream py-10 sm:py-14 print:bg-white print:py-0">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {flags.paid && quote.status === "sent" && (
            <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-success print:hidden" data-confirming>
              Thank you! We&rsquo;re just confirming your deposit. Refresh in a moment.
            </p>
          )}
          {flags.error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger print:hidden">{flags.error}</p>}

          <article className="rounded-[28px] border border-line bg-white p-6 sm:p-10 print:rounded-none print:border-0 print:p-0" data-quote={quote.status}>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} className="h-12 w-auto" />
                <p className="mt-3 text-sm text-text-2">
                  {business.fullName}
                  <br />
                  Gas Safe registered {business.gasSafeNumber}
                  <br />
                  {business.base} · {business.phoneDisplay}
                  <br />
                  {business.email}
                </p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-extrabold tracking-tight text-navy">Quote {quoteNumber(quote.number)}</h1>
                <p className="mt-1 text-sm text-text-2">{DATE.format(new Date(quote.sentAt ?? quote.createdAt))}</p>
                <p
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                    quote.status === "accepted" ? "bg-success/10 text-success" : open ? "bg-terracotta-deep/10 text-terracotta-deep" : "bg-navy/10 text-navy"
                  }`}
                >
                  {quote.status === "accepted" ? "Accepted" : open ? `Open until ${longDate(quote.validUntil).replace(/^\w+ /, "")}` : quote.status === "declined" ? "Declined" : quote.status === "cancelled" ? "Withdrawn" : "Ran out"}
                </p>
              </div>
            </header>

            {customer && (
              <p className="mt-6 text-sm text-text-2">
                For <span className="font-semibold text-navy">{customer.name || customer.email}</span>
                {[customer.address, customer.postcode].filter(Boolean).length ? `, ${[customer.address, customer.postcode].filter(Boolean).join(", ")}` : ""}
              </p>
            )}
            <p className="mt-1 font-semibold text-navy">{quote.title}</p>

            <table className="mt-6 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-text-2">
                  <th className="py-2 font-semibold">Item</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-3 pr-4 text-navy">{l.description}</td>
                    <td className="whitespace-nowrap py-3 text-right text-navy">{formatPence(l.amountPence)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 text-lg font-bold text-navy">Total</td>
                  <td className="pt-4 text-right text-2xl font-extrabold text-navy" data-amount>
                    {formatPence(quote.totalPence)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {quote.details && (
              <section className="mt-6 rounded-2xl bg-cream px-4 py-3" aria-labelledby="included">
                <h2 id="included" className="text-sm font-semibold text-navy">
                  What&rsquo;s included
                </h2>
                <p className="mt-1 whitespace-pre-wrap text-text-2">{quote.details}</p>
              </section>
            )}

            <ul className="mt-6 flex flex-col gap-1.5 text-sm text-text-2">
              {quote.depositPence > 0 && (
                <li>
                  <span className="font-semibold text-navy">{formatPence(quote.depositPence)} deposit</span> to accept and book in, then {formatPence(rest)} when the work&rsquo;s done.
                </li>
              )}
              {quote.balanceInstalments && (
                <li>
                  You can pay {quote.depositPence > 0 ? "the rest" : "it"} monthly over {quote.balanceInstalments} months, interest-free, once it&rsquo;s done.
                </li>
              )}
            </ul>

            {quote.status === "accepted" ? (
              <p className="mt-8 rounded-2xl bg-success/10 px-5 py-4 font-semibold text-success" data-accepted>
                {flags.accepted || flags.paid ? "Thank you! " : ""}You accepted this quote{quote.acceptedAt ? ` on ${DATE.format(new Date(quote.acceptedAt))}` : ""}
                {quote.depositPence > 0 ? `, with the ${formatPence(quote.depositPence)} deposit paid` : ""}. We&rsquo;ll be in touch to book the date.
              </p>
            ) : open ? (
              <div className="mt-8 flex flex-col gap-3 print:hidden">
                {canPayDeposit ? (
                  <form action={acceptThisQuote.bind(null, token)}>
                    <button
                      type="submit"
                      className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-terracotta-deep px-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
                      data-accept
                    >
                      {quote.depositPence > 0 ? `Accept and pay the ${formatPence(quote.depositPence)} deposit` : "Accept this quote"}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-2xl bg-cream px-4 py-3 text-text-2">To accept, call us on {business.phoneDisplay} and we&rsquo;ll take the deposit.</p>
                )}
                {quote.depositPence > 0 && canPayDeposit && <p className="text-center text-xs text-text-2">Apple Pay, Google Pay or card, securely by Stripe.</p>}
                <details className="rounded-2xl border border-line px-4 py-1">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-text-2">Not for me</summary>
                  <form action={declineThisQuote.bind(null, token)} className="flex flex-col gap-3 pb-4 pt-1">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-navy">
                        Mind telling us why? <span className="text-text-2">(optional)</span>
                      </span>
                      <textarea name="reason" rows={2} maxLength={500} className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base outline-none focus:border-navy/40" />
                    </label>
                    <button type="submit" className="inline-flex min-h-11 items-center self-start rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
                      No thanks
                    </button>
                  </form>
                </details>
              </div>
            ) : (
              <p className="mt-8 rounded-2xl bg-cream px-5 py-4 text-text-2">
                {quote.status === "declined"
                  ? `${flags.declined ? "Thanks for letting us know. " : ""}Changed your mind? Just get in touch.`
                  : quote.status === "cancelled"
                    ? "This quote has been withdrawn. Get in touch if you'd like a new one."
                    : ranOut || quote.status === "expired"
                      ? `This quote ran out on ${longDate(quote.validUntil)}. Get in touch for an updated one.`
                      : "This quote is no longer open."}
              </p>
            )}
          </article>

          <div className="mt-4 flex justify-center print:hidden">
            <PrintButton className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4" />
          </div>
          <div className="print:hidden">
            <ContactOptions className="mt-8" />
          </div>
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
