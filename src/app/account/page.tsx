import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { CustomerFields } from "@/components/customer-fields";
import { CHAT_ON } from "@/lib/chat-on";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { customerForUser } from "@/lib/customers";
import { appointmentsForCustomer } from "@/lib/appointments";
import { KIND_LABEL, REQUESTABLE_KINDS, STATUS_LABEL, longDate } from "@/lib/day-plan";
import { requestedWhen, whenLine } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { DayPartFields } from "@/components/DayPartPicker";
import { formatPence, invoiceNumber, paymentsForCustomer } from "@/lib/payments";
import { BILLING_LABEL, PLAN_BENEFITS, earliestEnd, minTermLine, planDate, planFor, planOpen, planPrices, priceLine } from "@/lib/maintenance-plan";
import { instalmentProgress } from "@/lib/instalments";
import { cancelMyPlan, keepMyPlan, openBillingPortal, requestVisit, sendSignInLink, signOut, startPlan, updateMyDetails } from "./actions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const FIELD =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:border-foreground/40";
const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">{children}</div>
      </main>
      <Footer />
    </>
  );
}

/**
 * The customer's account: their upcoming visits, and their details and
 * boiler, which they can keep up to date themselves (the team sees the same
 * record). Signing in is by an emailed link. Kanvas Academy's account page
 * is the starting point; MPE's customers have visits and a boiler instead
 * of memberships and dancers.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; saved?: string; requested?: string; requestError?: string; plan?: string; planError?: string }>;
}) {
  const { sent, error, saved, requested, requestError, plan: planFlash, planError } = await searchParams;

  if (!CHAT_ON) {
    return (
      <Shell>
        <Eyebrow>Your account</Eyebrow>
        <Heading as="h1" lead="Your account." em="Coming soon." emLine className="mt-3 text-[36px] sm:text-5xl" />
        <div className={`mt-8 ${CARD}`}>
          <p className="text-text-2">Soon you&rsquo;ll be able to see your visits and keep your details up to date here. In the meantime, we&rsquo;re a call, a WhatsApp or an email away.</p>
          <ContactOptions className="mt-6" />
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out, or only a chat guest so far: the sign-in form.
  if (!user || user.is_anonymous) {
    return (
      <Shell>
        <Eyebrow>Your account</Eyebrow>
        <Heading as="h1" lead="Your visits and details," em="in one place." emLine className="mt-3 text-[36px] sm:text-5xl" />
        <div className={`mt-8 ${CARD}`}>
          {sent ? (
            <div data-link-sent>
              <h2 className="text-xl font-semibold text-navy">Check your email</h2>
              <p className="mt-2 text-text-2">
                We&rsquo;ve sent a sign-in link to <strong className="text-navy">{sent}</strong>. Open it on this device to see your account.
              </p>
              <Link href="/account" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-terracotta-deep underline underline-offset-4">
                Use a different email
              </Link>
            </div>
          ) : (
            <form action={sendSignInLink} className="flex flex-col gap-4">
              <p className="text-text-2">Enter the email you booked with. We&rsquo;ll email you a link to sign in, no password needed.</p>
              {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-navy">Email</span>
                <input name="email" type="email" required autoComplete="email" inputMode="email" className={FIELD} />
              </label>
              <button type="submit" className={BUTTON}>
                Email me a sign-in link
              </button>
            </form>
          )}
        </div>
      </Shell>
    );
  }

  if (await isCoach(user.id)) redirect("/staff/schedule");

  const customer = await customerForUser(user.id, user.email);
  const today = londonNow().dateISO;
  const visits = customer ? await appointmentsForCustomer(customer.id) : [];
  const payments = customer ? (await paymentsForCustomer(customer.id)).filter((x) => x.status !== "cancelled") : [];
  const upcoming = visits.filter((v) => v.day >= today && (v.status === "booked" || v.status === "requested")).reverse();
  const past = visits.filter((v) => v.status === "done").slice(0, 10);
  const [plan, prices, progress] = await Promise.all([
    customer ? planFor(customer.id) : Promise.resolve(null),
    planPrices(),
    instalmentProgress(payments),
  ]);
  const onPlan = plan && (plan.status === "active" || plan.status === "past_due") ? plan : null;
  const canJoin = !onPlan && planOpen(prices);
  const paysMonthly = payments.some((p) => p.planStatus === "active" || p.planStatus === "past_due");

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <Heading as="h1" lead={customer?.name ? `Hi ${customer.name.split(" ")[0]}.` : "Hi there."} className="mt-3 text-[36px] sm:text-5xl" />
          <p className="mt-2 text-sm text-text-2">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-medium text-text-2 underline underline-offset-4 hover:text-navy">
            Sign out
          </button>
        </form>
      </div>

      <section className={`mt-8 ${CARD}`} aria-labelledby="visits">
        <h2 id="visits" className="text-xl font-semibold text-navy">
          Your visits
        </h2>
        {requested && (
          <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
            Thanks, your request is in. We&rsquo;ll be in touch to confirm the time.
          </p>
        )}
        {upcoming.length === 0 ? (
          <p className="mt-2 text-text-2">Nothing booked at the moment.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3" data-my-visits>
            {upcoming.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/visit/${v.publicToken}`}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-line bg-cream px-4 py-3 transition-colors hover:border-navy/40"
                  data-my-visit={v.status}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{KIND_LABEL[v.kind]}</span>
                    <span className="block text-text-2">
                      {v.status === "requested"
                        ? `You asked for ${requestedWhen(v.day, v.part)}${v.part === "any" || !v.part ? ", any time" : ""}`
                        : whenLine(v)}
                    </span>
                    {v.change && <span className="block text-sm text-text-2">You asked to move it. We&rsquo;ll be in touch.</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.status === "requested" ? "bg-navy/10 text-navy" : "bg-success/10 text-success"}`}
                  >
                    {v.status === "requested" ? "Waiting to confirm" : STATUS_LABEL[v.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/messages" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
            Message us
          </Link>
          <Link href="/emergency" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
            Boiler broken down?
          </Link>
        </div>
      </section>

      {past.length > 0 && (
        <section id="past" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-xl font-semibold text-navy">
            Past visits
          </h2>
          <ul className="mt-4 flex flex-col gap-3" data-past-visits>
            {past.map((v) => (
              <li key={v.id}>
                <Link href={`/visit/${v.publicToken}`} className="block rounded-2xl border border-line bg-cream px-4 py-3 transition-colors hover:border-navy/40">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-navy">{KIND_LABEL[v.kind]}</span>
                    <span className="text-sm text-text-2">{longDate(v.day)}</span>
                  </span>
                  {v.jobReport && <span className="mt-1 line-clamp-2 block text-sm text-text-2">{v.jobReport}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(onPlan || canJoin) && (
        <section id="plan" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="plan-heading" data-my-plan={onPlan ? onPlan.status : "join"}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id="plan-heading" className="text-xl font-semibold text-navy">
              Maintenance plan
            </h2>
            {onPlan && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  onPlan.status === "past_due" ? "bg-danger/10 text-danger" : onPlan.cancelAt ? "bg-navy/10 text-navy" : "bg-success/10 text-success"
                }`}
              >
                {onPlan.status === "past_due" ? "Payment failed" : onPlan.cancelAt ? `Ends ${planDate(onPlan.cancelAt)}` : "Active"}
              </span>
            )}
          </div>
          {planFlash === "cancelled" && (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">Cancelled. You&rsquo;re covered until it ends.</p>
          )}
          {planFlash === "kept" && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">Great, your plan carries on.</p>}
          {planError && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{planError}</p>}
          <ul className="mt-4 flex flex-col gap-2">
            {PLAN_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-navy">
                <span className="font-bold text-success" aria-hidden="true">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
          {onPlan ? (
            <>
              <p className="mt-4 text-text-2">
                {onPlan.pricePence && onPlan.billing ? `${formatPence(onPlan.pricePence)} ${BILLING_LABEL[onPlan.billing]}` : "On the plan"}
                {onPlan.startedAt ? `, since ${planDate(onPlan.startedAt)}` : ""}.
                {!onPlan.cancelAt && onPlan.currentPeriodEnd ? ` Next payment ${planDate(onPlan.currentPeriodEnd)}.` : ""}
                {onPlan.lastServiceOn ? ` Last service ${longDate(onPlan.lastServiceOn)}.` : ""}
              </p>
              {onPlan.status === "past_due" && (
                <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
                  Your last payment didn&rsquo;t go through. Update your card and we&rsquo;ll try again.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={openBillingPortal}>
                  <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
                    Update card and see payments
                  </button>
                </form>
                {onPlan.cancelAt ? (
                  <form action={keepMyPlan.bind(null, onPlan.id)}>
                    <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-terracotta-deep px-4 text-sm font-semibold text-white hover:opacity-90">
                      Keep my plan
                    </button>
                  </form>
                ) : (
                  <details className="w-full rounded-2xl border border-line px-4 py-1">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-text-2">Cancel my plan</summary>
                    <div className="pb-4 pt-1">
                      <p className="text-sm text-text-2">
                        {(() => {
                          const end = earliestEnd(onPlan);
                          return end ? `It'll end on ${planDate(end.toISOString())}, and you're covered until then.` : "It'll end at the end of what you've paid for.";
                        })()}
                        {onPlan.minMonths > 0 ? ` ${minTermLine(onPlan.minMonths)}` : ""}
                      </p>
                      <form action={cancelMyPlan.bind(null, onPlan.id)} className="mt-3">
                        <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger/10">
                          Yes, cancel my plan
                        </button>
                      </form>
                    </div>
                  </details>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-text-2">
                {priceLine(prices)}. {minTermLine(prices.minMonths)}
              </p>
              <form action={startPlan} className="mt-5">
                <button type="submit" className={BUTTON}>
                  Join the plan
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {payments.length > 0 && (
        <section id="payments" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="text-xl font-semibold text-navy">
            Invoices and payments
          </h2>
          <ul className="mt-4 flex flex-col gap-2" data-my-payments>
            {payments.map((pay) => (
              <li key={pay.id}>
                <Link
                  href={`/pay/${pay.publicToken}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-cream px-4 py-3 transition-colors hover:border-navy/40"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{pay.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(pay.number)}`}</span>
                    <span className="block truncate text-sm text-text-2">{pay.kind === "callout_fee" ? "Comes off your repair if you go ahead" : pay.description}</span>
                    {pay.status === "open" && pay.planStatus && (
                      <span className={`block text-sm ${pay.planStatus === "past_due" ? "text-danger" : "text-text-2"}`}>
                        Paying monthly: {formatPence(progress.get(pay.id)?.balancePence ?? pay.amountPence)} left
                        {pay.planStatus === "past_due" ? ", last payment failed" : ""}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-navy">{formatPence(pay.amountPence)}</span>
                    <span className={`block text-xs font-semibold ${pay.status === "paid" ? "text-success" : "text-terracotta-deep"}`}>
                      {pay.status === "paid" ? "Paid" : pay.planStatus ? "Monthly" : "Pay now"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {paysMonthly && <p className="mt-4 text-sm text-text-2">Open an invoice you&rsquo;re paying monthly to pay some off or change the card.</p>}
        </section>
      )}

      <section id="request" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="request-heading">
        <h2 id="request-heading" className="text-xl font-semibold text-navy">
          Request a visit
        </h2>
        <p className="mt-1 text-text-2">Pick a day and time that suits you. We&rsquo;ll confirm it, or suggest the nearest time we have.</p>
        {requestError && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{requestError}</p>}
        <form action={requestVisit} className="mt-5 flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-navy">What do you need?</legend>
            <div className="grid grid-cols-3 gap-2">
              {REQUESTABLE_KINDS.map((k, i) => (
                <label
                  key={k}
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-white px-3 text-center text-sm font-semibold text-navy transition-colors hover:border-navy/40 has-[:checked]:border-terracotta-deep has-[:checked]:bg-terracotta-deep has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy/40"
                >
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />
                  {KIND_LABEL[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <DayPartFields submitLabel="Send request">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-navy">
                What&rsquo;s it about? <span className="font-normal text-text-2">(optional)</span>
              </span>
              <textarea name="note" rows={2} maxLength={500} className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base outline-none focus:border-navy/40" />
            </label>
          </DayPartFields>
        </form>
      </section>

      <section id="details" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-xl font-semibold text-navy">
          Your details and boiler
        </h2>
        <p className="mt-1 text-text-2">Keep these up to date and our engineers arrive knowing what to expect.</p>
        {saved && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">Saved. Thanks!</p>}
        {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
        <form action={updateMyDetails} className="mt-6 flex flex-col gap-6">
          <CustomerFields customer={customer} withEmail={false} />
          <button type="submit" className={`${BUTTON} self-start`}>
            Save details
          </button>
        </form>
      </section>
    </Shell>
  );
}
