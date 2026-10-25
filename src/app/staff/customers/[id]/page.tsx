import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDisplayName } from "@/lib/display-name";
import { customerLabel, getCustomer, listCustomerNotes } from "@/lib/customers";
import { appointmentsForCustomer, type Appointment } from "@/lib/appointments";
import { CATEGORY_LABEL, STATUS_LABEL as ENQUIRY_STATUS_LABEL, enquiriesForCustomer, sourceLine } from "@/lib/enquiries";
import { KIND_LABEL, KIND_STYLE, STATUS_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { londonNow, londonParts, formatLondonClock } from "@/lib/schedule-time";
import { CustomerFields } from "@/components/customer-fields";
import { PhoneIcon } from "@/components/icons";
import { addNote, managePlan, openCustomerChat, removeNote, saveCustomer } from "../actions";
import { BILLING_LABEL, earliestEnd, planDate, planFor, planOpen, planPrices } from "@/lib/maintenance-plan";
import { instalmentProgress } from "@/lib/instalments";
import { PAID_VIA_LABEL, formatPence, invoiceNumber, paymentsForCustomer } from "@/lib/payments";
import { reviewsForCustomer, type JobReview } from "@/lib/job-completion";

export const metadata: Metadata = { title: "Customer" };

const SUCCESS: Record<string, string> = { saved: "Details saved.", added: "Customer added." };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(iso: string): string {
  const { day, month, year } = londonParts(iso);
  return `${day} ${MONTHS[month]} ${year}, ${formatLondonClock(iso)}`;
}

function VisitRow({ a, review }: { a: Appointment; review?: JobReview & { appointmentId: string } }) {
  return (
    <li>
      <Link
        href={`/staff/schedule?view=day&date=${a.day}#visit-${a.id}`}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors hover:border-foreground/40 ${a.status === "cancelled" ? "border-border opacity-60" : "border-border"}`}
      >
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${KIND_STYLE[a.kind].dot}`} aria-hidden="true" />
          <span className="font-semibold">{KIND_LABEL[a.kind]}</span>
          <span className="text-muted">
            {longDate(a.day)}, {windowLabel(a.start, a.end)}
          </span>
        </span>
        <span className="text-xs font-medium text-muted">
          {STATUS_LABEL[a.status]}
          {review ? ` · ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}` : ""}
        </span>
        {a.jobReport && <span className="w-full text-xs text-muted">What we did: {a.jobReport}</span>}
        {review?.comment && <span className="w-full text-xs italic text-muted">“{review.comment}”{review.publicClickedAt ? " · went on to Google" : ""}</span>}
      </Link>
    </li>
  );
}

/**
 * One customer: their details and boiler (the team can change any of it),
 * the team's private notes, their visits, and every booking form they've
 * sent. Kanvas Academy's contact page (coach/students/contacts/[id]) is the
 * starting point; MPE adds the boiler, notes and visits.
 */
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; planDone?: string }>;
}) {
  const { id } = await params;
  const { error, success, planDone } = await searchParams;
  const user = await requireStaff(`/staff/customers/${id}`);
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [notes, visits, bookings, payments] = await Promise.all([
    listCustomerNotes(id),
    appointmentsForCustomer(id),
    enquiriesForCustomer(id),
    paymentsForCustomer(id),
  ]);
  const [reviews, plan, prices, progress] = await Promise.all([reviewsForCustomer(id), planFor(id), planPrices(), instalmentProgress(payments)]);
  const onPlan = plan && (plan.status === "active" || plan.status === "past_due") ? plan : null;
  const today = londonNow().dateISO;
  const upcoming = visits.filter((v) => v.day >= today && v.status === "booked").reverse();
  const past = visits.filter((v) => !(v.day >= today && v.status === "booked"));

  // Who wrote each note.
  const authorIds = [...new Set(notes.map((n) => n.authorId).filter((a): a is string => !!a && a !== user.id))];
  const admin = createAdminClient();
  const authors = new Map<string, string>();
  await Promise.all(
    authorIds.map(async (authorId) => {
      const { data } = await admin.auth.admin.getUserById(authorId);
      if (data?.user) authors.set(authorId, resolveDisplayName(data.user));
    }),
  );

  const label = customerLabel(customer);
  const button =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-foreground/40";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/staff/customers" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Back to Customers
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-1 text-sm text-muted">
            {[customer.address, customer.postcode].filter(Boolean).join(", ") || "No address yet"}
            {customer.userId ? " · Has an account" : ""}
          </p>
          {onPlan && (
            <a href="#plan" className="mt-2 inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success" data-plan-badge>
              On the maintenance plan{onPlan.status === "past_due" ? " · payment failed" : onPlan.cancelAt ? ` · ends ${planDate(onPlan.cancelAt)}` : ""}
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/staff/schedule?view=day&date=${today}&customer=${customer.id}#add`}
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Book a visit
        </Link>
        {customer.phone && (
          <a href={`tel:${customer.phoneE164 ?? customer.phone}`} className={button}>
            <PhoneIcon className="h-4 w-4" aria-hidden="true" />
            {customer.phone}
          </a>
        )}
        <form action={openCustomerChat.bind(null, customer.id)}>
          <button type="submit" className={button}>
            Messages
          </button>
        </form>
        {customer.email && (
          <a href={`mailto:${customer.email}`} className={button}>
            {customer.email}
          </a>
        )}
      </div>

      {success && SUCCESS[success] && (
        <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">{SUCCESS[success]}</p>
      )}
      {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}

      <section id="plan" className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-lg font-semibold">
          Maintenance plan
        </h2>
        {planDone && <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">{planDone}</p>}
        {onPlan ? (
          <>
            <p className="mt-1 text-sm">
              {onPlan.pricePence && onPlan.billing ? `${formatPence(onPlan.pricePence)} ${BILLING_LABEL[onPlan.billing]}` : "On the plan"}
              {onPlan.startedAt ? ` since ${planDate(onPlan.startedAt)}` : ""}.{" "}
              {onPlan.status === "past_due" ? (
                <span className="font-semibold text-danger">Last payment failed: they&rsquo;ve been sent a link to fix it.</span>
              ) : onPlan.cancelAt ? (
                `Cancelled: ends ${planDate(onPlan.cancelAt)}.`
              ) : onPlan.currentPeriodEnd ? (
                `Next payment ${planDate(onPlan.currentPeriodEnd)}.`
              ) : null}
            </p>
            <p className="mt-1 text-sm text-muted">
              No call-out fee, and their yearly service is included. {onPlan.lastServiceOn ? `Last service ${longDate(onPlan.lastServiceOn)}.` : "No service on the plan yet."}
            </p>
            <form action={managePlan.bind(null, customer.id)} className="mt-3 flex flex-wrap gap-2">
              {onPlan.cancelAt ? (
                <button type="submit" name="intent" value="keep" className={button}>
                  Keep it going
                </button>
              ) : (
                <button type="submit" name="intent" value="cancel" className={button}>
                  Cancel{(() => {
                    const end = earliestEnd(onPlan);
                    return end ? ` (ends ${planDate(end.toISOString())})` : "";
                  })()}
                </button>
              )}
            </form>
            <details className="mt-2 text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center font-medium text-danger">End it today instead</summary>
              <form action={managePlan.bind(null, customer.id)} className="flex flex-wrap items-center gap-3 pb-2">
                <span className="text-muted">It stops today. What they&rsquo;ve paid isn&rsquo;t refunded automatically: refund in Stripe if it should be.</span>
                <button type="submit" name="intent" value="end_now" className="min-h-11 rounded-full border border-danger/40 px-4 font-semibold text-danger hover:bg-danger/10">
                  End the plan now
                </button>
              </form>
            </details>
          </>
        ) : planOpen(prices) ? (
          <form action={managePlan.bind(null, customer.id)} className="mt-2 flex flex-wrap items-center gap-3">
            <p className="w-full text-sm text-muted">
              {plan?.status === "pending" ? "They've been sent the link but haven't joined yet." : plan?.status === "ended" ? "Their plan has ended." : "Not on the plan."}
            </p>
            <button type="submit" name="intent" value="send" className="min-h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
              {plan?.status === "pending" ? "Send the plan link again" : "Send them the plan"}
            </button>
          </form>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Not on the plan. Set the plan&rsquo;s price in{" "}
            <Link href="/staff/settings#plan" className="underline underline-offset-4">
              Settings
            </Link>{" "}
            to send them a link to join.
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="upcoming">
        <h2 id="upcoming" className="text-lg font-semibold">
          Upcoming visits
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing booked.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((a) => (
              <VisitRow key={a.id} a={a} review={reviews.find((r) => r.appointmentId === a.id)} />
            ))}
          </ul>
        )}
      </section>

      <section id="notes" className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-lg font-semibold">
          Private notes
        </h2>
        <p className="mt-1 text-sm text-muted">Only the team sees these. The customer never does.</p>
        <form action={addNote.bind(null, customer.id)} className="mt-4 flex flex-col gap-3">
          <label htmlFor="note" className="sr-only">
            New note
          </label>
          <textarea
            id="note"
            name="body"
            rows={3}
            required
            placeholder="e.g. Boiler's on its last legs, quote for a replacement next visit"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm"
          />
          <button type="submit" className="min-h-11 self-start rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90">
            Add note
          </button>
        </form>
        {notes.length > 0 && (
          <ul className="mt-5 flex flex-col gap-3" data-notes>
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {n.authorId === user.id ? "You" : (n.authorId && authors.get(n.authorId)) || "Team"} · {when(n.createdAt)}
                  </span>
                  <form action={removeNote.bind(null, customer.id, n.id)}>
                    <button type="submit" className="min-h-9 rounded-full px-2 font-medium text-danger hover:bg-danger/10">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="details">
        <h2 id="details" className="text-lg font-semibold">
          Details and boiler
        </h2>
        {customer.userId && <p className="mt-1 text-sm text-muted">They can update these from their account too.</p>}
        <form action={saveCustomer.bind(null, customer.id)} className="mt-4 flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <CustomerFields customer={customer} />
          <button
            type="submit"
            className="min-h-11 self-start rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Save details
          </button>
        </form>
      </section>

      {past.length > 0 && (
        <section className="mt-8" aria-labelledby="past">
          <h2 id="past" className="text-lg font-semibold">
            Past and cancelled visits
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {past.map((a) => (
              <VisitRow key={a.id} a={a} review={reviews.find((r) => r.appointmentId === a.id)} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="payments">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="payments" className="text-lg font-semibold">
            Invoices and payments
          </h2>
          <Link href={`/staff/payments/new?customer=${customer.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-foreground/40">
            Take payment
          </Link>
        </div>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {payments.map((pay) => (
              <li key={pay.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{pay.kind === "callout_fee" ? "Call-out fee" : `${invoiceNumber(pay.number)} · ${pay.description}`}</span>
                  <span className="block text-xs text-muted">{when(pay.createdAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{formatPence(pay.amountPence)}</span>
                  <span className={`text-xs ${pay.status === "paid" ? "font-medium text-success" : pay.planStatus === "past_due" ? "font-medium text-danger" : "text-muted"}`}>
                    {pay.status === "paid"
                      ? `Paid${pay.paidVia ? ` · ${PAID_VIA_LABEL[pay.paidVia]}` : ""}`
                      : pay.status === "cancelled"
                        ? "Cancelled"
                        : pay.planStatus
                          ? `${pay.planStatus === "stopped" ? "Monthly stopped" : "Monthly"} · ${formatPence(progress.get(pay.id)?.balancePence ?? pay.amountPence)} left`
                          : "Waiting"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="bookings">
        <h2 id="bookings" className="text-lg font-semibold">
          Booking forms
        </h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {CATEGORY_LABEL[b.category]}
                    {b.sameDay && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">Same day</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {when(b.createdAt)} · {ENQUIRY_STATUS_LABEL[b.status]}
                  </span>
                </div>
                {(b.answers.length > 0 || b.message) && (
                  <p className="mt-1 text-muted">
                    {[...b.answers.filter((a) => a.q !== "Postcode").map((a) => a.a), b.message].filter(Boolean).join(" · ")}
                  </p>
                )}
                {sourceLine(b) && <p className="mt-1 text-xs text-muted">{sourceLine(b)}</p>}
                {(b.status === "new" || b.status === "contacted") && (
                  <Link
                    href={`/staff/schedule?view=day&date=${today}&enquiry=${b.id}#add`}
                    className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-accent underline underline-offset-4"
                  >
                    Book this in
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
