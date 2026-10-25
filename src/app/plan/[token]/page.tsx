import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { enquiriesOn } from "@/lib/enquiries";
import { formatPence } from "@/lib/payments";
import { BILLING_LABEL, PLAN_BENEFITS, minTermLine, planDate, planMemberByToken, planOpen, planPrices } from "@/lib/maintenance-plan";
import { joinPlan } from "./actions";

export const metadata: Metadata = {
  title: "Maintenance plan",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";

/**
 * The maintenance plan, from the customer's link (sent by Fergal, or from
 * their account): what's included, monthly or yearly, and Join (Stripe
 * Checkout). Once they're on it, it says so and points to their account.
 * No sign-in: the link is private to them.
 */
export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ joined?: string; error?: string }>;
}) {
  const { token } = await params;
  const { joined, error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const member = await planMemberByToken(token);
  if (!member) notFound();
  const [customer, prices] = await Promise.all([getCustomer(member.customerId), planPrices()]);
  const first = customer?.name?.split(" ")[0];
  const live = member.status === "active" || member.status === "past_due";
  const open = planOpen(prices);
  const yearlySaving = prices.monthPence && prices.yearPence ? prices.monthPence * 12 - prices.yearPence : 0;
  const options = (["month", "year"] as const).filter((b) => (b === "month" ? prices.monthPence : prices.yearPence));

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>{business.name} maintenance plan</Eyebrow>
          <Heading as="h1" lead={first ? `${first}, stay covered` : "Stay covered"} em="all year." emLine className="mt-3 text-[36px] sm:text-5xl" />

          {error && <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
          {joined && member.status === "pending" && (
            <p className="mt-6 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-success" data-confirming>
              Thank you! We&rsquo;re just setting up your plan. Refresh in a moment.
            </p>
          )}

          <div className={`mt-8 ${CARD}`} data-plan={member.status}>
            <h2 className="text-xl font-semibold text-navy">What you get</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {PLAN_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-navy">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-sm font-bold text-success" aria-hidden="true">
                    ✓
                  </span>
                  <span className="font-semibold">{b}</span>
                </li>
              ))}
            </ul>

            {live ? (
              <div className="mt-8 rounded-2xl bg-success/10 p-5" data-plan-live>
                <p className="text-lg font-semibold text-success">You&rsquo;re on the plan{member.status === "past_due" ? ", but your last payment didn't go through" : ""}.</p>
                <p className="mt-1 text-text-2">
                  {member.pricePence && member.billing ? `${formatPence(member.pricePence)} ${BILLING_LABEL[member.billing]}` : ""}
                  {member.startedAt ? ` since ${planDate(member.startedAt)}` : ""}. If your boiler breaks down, call {business.phoneDisplay} or message us.
                </p>
                <Link href="/account#plan" className="mt-4 inline-flex min-h-11 items-center font-semibold text-terracotta-deep underline underline-offset-4">
                  Manage your plan
                </Link>
              </div>
            ) : member.status === "ended" ? (
              <p className="mt-8 rounded-2xl bg-cream p-5 text-text-2">
                This plan has ended. To join again, sign in to{" "}
                <Link href="/account#plan" className="font-semibold text-navy underline underline-offset-4">
                  your account
                </Link>{" "}
                or give us a call.
              </p>
            ) : !open ? (
              <p className="mt-8 rounded-2xl bg-cream p-5 text-text-2">Joining online isn&rsquo;t available just now. Please call us on {business.phoneDisplay} and we&rsquo;ll set it up.</p>
            ) : (
              <form action={joinPlan.bind(null, token)} className="mt-8 flex flex-col gap-4" data-join-plan>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-navy">How would you like to pay?</legend>
                  <div className={`grid gap-2 ${options.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {options.map((b, i) => (
                      <label
                        key={b}
                        className="flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl border-2 border-line bg-white px-4 py-3 transition-colors hover:border-navy/30 has-[:checked]:border-terracotta-deep has-[:checked]:bg-terracotta-deep/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy/40"
                      >
                        <input type="radio" name="billing" value={b} defaultChecked={i === 0} className="sr-only" />
                        <span className="text-lg font-bold text-navy">
                          {formatPence((b === "month" ? prices.monthPence : prices.yearPence) ?? 0)} {BILLING_LABEL[b]}
                        </span>
                        <span className="text-sm text-text-2">
                          {b === "month" ? "Paid monthly by card" : yearlySaving > 0 ? `Paid once a year: ${formatPence(yearlySaving)} less than monthly` : "Paid once a year by card"}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {prices.minMonths > 0 && <p className="text-sm text-text-2">{minTermLine(prices.minMonths)} After that, cancel any time from your account.</p>}
                {prices.minMonths === 0 && <p className="text-sm text-text-2">Cancel any time from your account. It runs to the end of what you&rsquo;ve paid for.</p>}
                <button
                  type="submit"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-terracotta-deep px-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Join the plan
                </button>
                <p className="text-center text-xs text-text-2">Apple Pay, Google Pay or card, securely by Stripe.</p>
              </form>
            )}
          </div>

          <ContactOptions className="mt-8" />
        </div>
      </main>
      <Footer />
    </>
  );
}
