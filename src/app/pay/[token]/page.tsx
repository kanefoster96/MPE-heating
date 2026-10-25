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
import { PAID_VIA_LABEL, formatPence, getPaymentByToken, invoiceNumber, paymentsOn } from "@/lib/payments";
import { changeCard, payMonthly, payNow } from "./actions";
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
  searchParams: Promise<{ paid?: string; monthly?: string; error?: string }>;
}) {
  const { token } = await params;
  const { paid, monthly, error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const p = await getPaymentByToken(token);
  if (!p) notFound();
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  const title = p.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(p.number)}`;
  const isPaid = p.status === "paid";
  const onMonthly = p.planStatus === "active" || p.planStatus === "past_due";
  const offerMonthly = p.status === "open" && !p.planStatus && p.instalments ? instalmentSchedule(p.amountPence, p.instalments.months, p.instalments.depositPence) : null;
  const progress = p.planStatus ? (await instalmentProgress([p])).get(p.id) : undefined;

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
                  <td className="pt-4 text-lg font-bold text-navy">{isPaid ? "Paid" : p.offers.some((o) => !o.taken) || p.planStatus ? "Invoice total" : "Total to pay"}</td>
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
            {p.kind === "callout_fee" && !isPaid && (
              <p className="mt-4 text-sm text-text-2">If you go ahead with the repair, the call-out fee comes off your bill.</p>
            )}

            {p.instalments && progress && (onMonthly || p.planStatus === "stopped") && (
              <div className="mt-6 rounded-2xl bg-cream p-5" data-monthly-progress>
                <p className="font-semibold text-navy">
                  Paying monthly: {progress.paidCount} of {p.instalments.months} payments made ({formatPence(progress.paidPence)} of {formatPence(p.amountPence)})
                </p>
                {p.planStatus === "past_due" ? (
                  <p className="mt-1 text-sm text-danger">Your last payment didn&rsquo;t go through. Change your card and we&rsquo;ll try again.</p>
                ) : p.planStatus === "stopped" ? (
                  <p className="mt-1 text-sm text-text-2">Your monthly payments have stopped. Please call us on {business.phoneDisplay} about the rest.</p>
                ) : progress.nextOn ? (
                  <p className="mt-1 text-sm text-text-2">Next payment due {DATE.format(new Date(progress.nextOn))}, taken from your card automatically. No interest, nothing added.</p>
                ) : null}
                {onMonthly && (
                  <form action={changeCard.bind(null, token)} className="mt-3 print:hidden">
                    <button type="submit" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4">
                      Change card or see payments
                    </button>
                  </form>
                )}
              </div>
            )}

            {p.status === "open" && !onMonthly && p.planStatus !== "stopped" &&
              (paymentsOn() ? (
                <PayForm
                  action={payNow.bind(null, token)}
                  amountPence={p.amountPence}
                  offers={p.offers.map((o, index) => ({ index, label: o.label, pence: o.pence, usualPence: o.usualPence, taken: o.taken })).filter((o) => !o.taken)}
                  monthly={
                    offerMonthly?.ok ? (
                      <form action={payMonthly.bind(null, token)} className="rounded-2xl border-2 border-line bg-cream p-4" data-pay-monthly>
                        <p className="font-semibold text-navy">Or spread the cost, interest-free</p>
                        <p className="mt-1 text-sm text-text-2">
                          {scheduleSummary(offerMonthly.schedule, formatPence)}, taken from your card automatically. {formatPence(p.amountPence)} in all: no interest,
                          nothing added.
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
