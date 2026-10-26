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
import { PAID_VIA_LABEL, formatPence, getPaymentByToken, invoiceNumber, partPaymentsFor, paymentsOn, type PaidVia } from "@/lib/payments";
import { changeCard, payMonthly, payNow, payOff } from "./actions";
import { instalmentSchedule, scheduleSummary } from "@/lib/instalment-schedule";
import { instalmentProgress } from "@/lib/instalments";
import { PayForm } from "./pay-form";

export const metadata: Metadata = {
  title: "Your invoice",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

/**
 * A call-out fee or invoice, from the link in its message: the lines, the
 * total and Pay (Apple Pay, Google Pay or card, by Stripe Checkout), with a
 * tick to save the card with MPE for next time. Once paid it's the receipt.
 * Prints cleanly. No sign-in: the link is private to them.
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; monthly?: string; paidoff?: string; card?: string; error?: string }>;
}) {
  const { token } = await params;
  const { paid, monthly, paidoff, card, error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const p = await getPaymentByToken(token);
  if (!p) notFound();
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  const title = p.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(p.number)}`;
  const isPaid = p.status === "paid";
  const onMonthly = p.planStatus === "active" || p.planStatus === "past_due";
  const offerMonthly = p.status === "open" && !p.planStatus && p.instalments ? instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence) : null;
  const progress = p.planStatus ? (await instalmentProgress([p])).get(p.id) : undefined;
  // Paid in parts (some cash, the rest by card): what's in, and what's left.
  const parts = p.planStatus ? [] : ((await partPaymentsFor([p.id])).get(p.id) ?? []);
  const partPence = parts.reduce((sum, x) => sum + x.amountPence, 0);
  const leftPence = p.amountPence - partPence;

  return (
    <>
      <div className="print:hidden">
        <Nav />
      </div>
      <main className="bg-cream py-10 sm:py-14 print:bg-white print:py-0">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {paid && !isPaid && (
            <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-success print:hidden" data-confirming>
              Thank you! We&rsquo;re just confirming your payment. Refresh in a moment to see your receipt.
            </p>
          )}
          {monthly && !p.planStatus && (
            <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-success print:hidden" data-confirming>
              Thank you! We&rsquo;re just setting up your monthly payments. Refresh in a moment.
            </p>
          )}
          {(paidoff || card) && p.planStatus && (
            <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-success print:hidden">
              {paidoff ? "Thank you! It can take a moment to show below: refresh if it isn't there yet." : "Thanks, your monthly payments will come from your new card."}
            </p>
          )}
          {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger print:hidden">{error}</p>}

          <article className="rounded-[28px] border border-line bg-white p-6 sm:p-10 print:rounded-none print:border-0 print:p-0" data-invoice={p.status}>
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
                <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
                <p className="mt-1 text-sm text-text-2">{DATE.format(new Date(p.createdAt))}</p>
                <p
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                    isPaid ? "bg-success/10 text-success" : p.status === "cancelled" ? "bg-navy/10 text-navy" : "bg-terracotta-deep/10 text-terracotta-deep"
                  }`}
                >
                  {isPaid ? "Paid" : p.status === "cancelled" ? "Cancelled" : onMonthly ? "Paying monthly" : "To pay"}
                </p>
              </div>
            </header>

            {customer && (
              <p className="mt-6 text-sm text-text-2">
                For <span className="font-semibold text-navy">{customer.name || customer.email}</span>
                {[customer.address, customer.postcode].filter(Boolean).length ? `, ${[customer.address, customer.postcode].filter(Boolean).join(", ")}` : ""}
              </p>
            )}
            {p.kind !== "callout_fee" && <p className="mt-1 font-semibold text-navy">{p.description}</p>}

            <table className="mt-6 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-text-2">
                  <th className="py-2 font-semibold">Item</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-3 pr-4 text-navy">{l.description}</td>
                    <td className="whitespace-nowrap py-3 text-right text-navy">{formatPence(l.amountPence)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 text-lg font-bold text-navy">{isPaid ? "Paid" : p.offers.some((o) => !o.taken) || p.planStatus || partPence ? "Invoice total" : "Total to pay"}</td>
                  <td className="pt-4 text-right text-2xl font-extrabold text-navy" data-amount>
                    {formatPence(p.amountPence)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {isPaid && p.paidAt && (
              <p className="mt-4 text-sm text-text-2">
                Paid {DATE.format(new Date(p.paidAt))}
                {p.paidVia ? ` · ${PAID_VIA_LABEL[p.paidVia]}` : ""}. Thank you!
              </p>
            )}
            {parts.length > 0 && (
              <section className="mt-6 rounded-2xl bg-cream p-5" data-part-payments aria-labelledby="parts-heading">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="parts-heading" className="font-semibold text-navy">
                    {isPaid ? "Paid in parts" : "Paid so far"}
                  </h2>
                  {!isPaid && p.status === "open" && (
                    <p className="text-navy">
                      <span className="text-2xl font-extrabold" data-balance>
                        {formatPence(leftPence)}
                      </span>{" "}
                      <span className="text-sm text-text-2">left to pay</span>
                    </p>
                  )}
                </div>
                <ul className="mt-3 flex flex-col divide-y divide-line border-y border-line text-sm">
                  {parts.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span className="text-text-2">
                        {DATE.format(new Date(x.paidAt))}
                        {x.paidVia && x.paidVia in PAID_VIA_LABEL ? ` · ${PAID_VIA_LABEL[x.paidVia as PaidVia]}` : ""}
                      </span>
                      <span className="font-semibold text-navy">{formatPence(x.amountPence)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {p.kind === "callout_fee" && !isPaid && (
              <p className="mt-4 text-sm text-text-2">If you go ahead with the repair, the call-out fee comes off your bill.</p>
            )}

            {progress && p.planStatus && (
              <section id="monthly" className="mt-6 scroll-mt-24 rounded-2xl bg-cream p-5" data-monthly-progress aria-labelledby="monthly-heading">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="monthly-heading" className="font-semibold text-navy">
                    {isPaid ? "Paid off monthly" : "Paying monthly"}
                  </h2>
                  {!isPaid && (
                    <p className="text-navy">
                      <span className="text-2xl font-extrabold" data-balance>
                        {formatPence(progress.balancePence)}
                      </span>{" "}
                      <span className="text-sm text-text-2">left to pay</span>
                    </p>
                  )}
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={p.amountPence} aria-valuenow={progress.paidPence} aria-label="Paid so far">
                  <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.round((progress.paidPence / p.amountPence) * 100))}%` }} />
                </div>
                <p className="mt-2 text-sm text-text-2">
                  {formatPence(progress.paidPence)} of {formatPence(p.amountPence)} paid. No interest, nothing added.
                </p>
                {p.planStatus === "past_due" && (
                  <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    Your last monthly payment didn&rsquo;t go through. Please pay it below, or change your card.
                  </p>
                )}
                {p.planStatus === "stopped" && !isPaid && (
                  <p className="mt-3 text-sm text-text-2">Your monthly payments have stopped. You can pay what&rsquo;s left below, or call us on {business.phoneDisplay}.</p>
                )}
                {progress.nextOn && progress.nextPence && (
                  <p className="mt-3 text-sm font-semibold text-navy" data-next-payment>
                    Next payment: {formatPence(progress.nextPence)} on {DATE.format(new Date(`${progress.nextOn}T12:00:00Z`))}
                    {p.planMonthlyPence && progress.nextPence < p.planMonthlyPence ? ", the last one" : ""}, taken from your card automatically.
                  </p>
                )}

                {progress.payments.length > 0 && (
                  <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line text-sm" data-monthly-payments>
                    {progress.payments.map((pay, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2">
                        <span className="text-text-2">
                          {DATE.format(new Date(pay.paidAt))} · {pay.kind === "first" ? "First payment" : pay.kind === "monthly" ? "Monthly payment" : pay.kind === "extra" ? "Paid off" : "Paid in person"}
                        </span>
                        <span className="font-semibold text-navy">{formatPence(pay.amountPence)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!isPaid && p.status === "open" && paymentsOn() && (
                  <div className="mt-5 flex flex-col gap-3 print:hidden">
                    <form action={payOff.bind(null, token)} className="flex flex-col gap-2 sm:flex-row sm:items-end" data-pay-off>
                      <label className="flex flex-1 flex-col gap-1">
                        <span className="text-sm font-semibold text-navy">Pay some off now</span>
                        <span className="flex items-center rounded-lg border border-line bg-white px-3 focus-within:border-navy/40">
                          <span className="text-text-2" aria-hidden="true">
                            £
                          </span>
                          <input
                            name="amount"
                            inputMode="decimal"
                            required
                            defaultValue={((progress.nextPence ?? progress.balancePence) / 100).toString()}
                            aria-label="Amount in pounds"
                            className="w-full bg-transparent px-2 py-3 text-base text-navy outline-none"
                          />
                        </span>
                      </label>
                      <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-5 font-semibold text-white hover:opacity-90">
                        Pay this amount
                      </button>
                    </form>
                    <form action={payOff.bind(null, token)}>
                      <input type="hidden" name="amount" value={(progress.balancePence / 100).toString()} />
                      <button type="submit" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4">
                        Pay off the rest: {formatPence(progress.balancePence)}
                      </button>
                    </form>
                    {onMonthly && (
                      <form action={changeCard.bind(null, token)}>
                        <button type="submit" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4">
                          Change the card for monthly payments
                        </button>
                      </form>
                    )}
                    <p className="text-xs text-text-2">Paying extra doesn&rsquo;t change your dates or monthly amount. It just means you&rsquo;re done sooner, and the last payment is only what&rsquo;s left.</p>
                  </div>
                )}
              </section>
            )}

            {p.status === "open" && !onMonthly && p.planStatus !== "stopped" &&
              (paymentsOn() ? (
                <PayForm
                  action={payNow.bind(null, token)}
                  amountPence={leftPence}
                  offers={partPence ? [] : p.offers.map((o, index) => ({ index, label: o.label, pence: o.pence, usualPence: o.usualPence, taken: o.taken })).filter((o) => !o.taken)}
                  monthly={
                    offerMonthly?.ok && !partPence ? (
                      <form action={payMonthly.bind(null, token)} className="rounded-2xl border-2 border-line bg-cream p-4" data-pay-monthly>
                        <p className="font-semibold text-navy">Or spread the cost, interest-free</p>
                        <p className="mt-1 text-sm text-text-2">
                          {scheduleSummary(offerMonthly.schedule, formatPence)}, taken from your card automatically until it&rsquo;s paid. {formatPence(p.amountPence)} in
                          all: no interest, nothing added. Pay off more whenever you like.
                        </p>
                        <button
                          type="submit"
                          className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-navy px-5 font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
                        >
                          Pay {formatPence(offerMonthly.schedule.firstPence)} today and the rest monthly
                        </button>
                      </form>
                    ) : null
                  }
                />
              ) : (
                <p className="mt-8 rounded-2xl bg-cream px-4 py-3 text-text-2 print:hidden">
                  Online payment isn&rsquo;t switched on yet. Please call us on {business.phoneDisplay} to pay.
                </p>
              ))}
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
