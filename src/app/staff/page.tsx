import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { isAdmin } from "@/lib/coach";
import { resolveDisplayName } from "@/lib/display-name";
import { getNewEnquiryCount, getUnreadCountForCoach } from "@/lib/chat-db";
import { appointmentsBetween, waitingOnTeamCount } from "@/lib/appointments";
import { customerLabel, getCustomers } from "@/lib/customers";
import { KIND_LABEL, KIND_STYLE, STATUS_LABEL, WORKDAY, longDate, windowLabel } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { formatPence } from "@/lib/payments";
import { bookedPerDay, businessSnapshot } from "@/lib/dashboard";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Home" };

const CARD = "min-w-0 rounded-2xl border border-border bg-surface p-5";
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

/**
 * Fergal's home: what needs him now, today's visits, how full the next
 * fortnight is, and how the business is doing (money in and owed, the
 * maintenance plan, this month's jobs and where they came from, reviews).
 * Kanvas Academy's coach dashboard and finance page, for a boiler business.
 * Every number links to where it's dealt with.
 */
export default async function StaffHome() {
  const user = await requireStaff("/staff");
  const { dateISO: today, minutes } = londonNow();
  const [admin, unread, newJobs, waiting, visits, days, snap] = await Promise.all([
    isAdmin(user.id).catch(() => false),
    getUnreadCountForCoach(user.id).catch(() => 0),
    getNewEnquiryCount().catch(() => 0),
    waitingOnTeamCount(today).catch(() => 0),
    appointmentsBetween(today, today),
    bookedPerDay(today),
    businessSnapshot(today),
  ]);
  const todays = visits.filter((v) => v.status !== "cancelled" && v.status !== "requested");
  const customers = await getCustomers(todays.map((v) => v.customerId).filter((id): id is string => !!id));
  // Their first name, if they've one set (not their email).
  const name = resolveDisplayName(user);
  const first = name.includes("@") ? null : name.split(" ")[0];
  const greeting = minutes < 12 * 60 ? "Morning" : minutes < 18 * 60 ? "Afternoon" : "Evening";

  const needs = [
    { n: unread, label: `unread message${unread === 1 ? "" : "s"}`, href: "/staff/messages" },
    { n: newJobs, label: `new job${newJobs === 1 ? "" : "s"} to reply to`, href: "/staff/messages?tab=jobs" },
    { n: waiting, label: `visit request${waiting === 1 ? "" : "s"} to confirm`, href: "/staff/schedule" },
    { n: snap.overdueCount, label: `invoice${snap.overdueCount === 1 ? "" : "s"} unpaid over a week`, href: "/staff/invoices" },
    { n: snap.monthlyFailedCount, label: `monthly payment${snap.monthlyFailedCount === 1 ? "" : "s"} failed`, href: "/staff/invoices?show=monthly" },
    { n: snap.plan.failed, label: `plan payment${snap.plan.failed === 1 ? "" : "s"} failed`, href: "/staff/plan" },
    { n: snap.quotes.accepted, label: `accepted quote${snap.quotes.accepted === 1 ? "" : "s"} to book in`, href: "/staff/quotes?show=accepted" },
  ].filter((x) => x.n > 0);

  const change = snap.takenLastMonthPence ? Math.round(((snap.takenThisMonthPence - snap.takenLastMonthPence) / snap.takenLastMonthPence) * 100) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-sm uppercase tracking-widest text-muted">{longDate(today)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {greeting}
        {first ? `, ${first}` : ""}.
      </h1>

      <section className="mt-6" aria-labelledby="needs">
        <h2 id="needs" className="sr-only">
          Needs you
        </h2>
        {needs.length === 0 ? (
          <p className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">All caught up. Nothing waiting on you.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" data-needs>
            {needs.map((x) => (
              <li key={x.href + x.label}>
                <Link href={x.href} className="flex min-h-14 items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-3 transition-colors hover:border-accent">
                  <span className="text-2xl font-bold text-accent">{x.n}</span>
                  <span className="text-sm font-medium">{x.label}</span>
                  <span className="ml-auto text-muted" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className={CARD} aria-labelledby="today">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="today" className="text-lg font-semibold">
              Today
            </h2>
            <Link href={`/staff/schedule?view=day&date=${today}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">
              Open the day
            </Link>
          </div>
          {todays.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing booked today.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2" data-today>
              {todays.map((v) => {
                const c = v.customerId ? customers.get(v.customerId) : undefined;
                return (
                  <li key={v.id}>
                    <Link
                      href={`/staff/schedule?view=day&date=${today}#visit-${v.id}`}
                      className={`flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-foreground/40 ${v.status === "done" ? "opacity-60" : ""}`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KIND_STYLE[v.kind].dot}`} aria-hidden="true" />
                      <span className="w-24 shrink-0 font-semibold">{windowLabel(v.start, v.end)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {c ? customerLabel(c) : v.title || KIND_LABEL[v.kind]}
                        <span className="text-muted"> · {KIND_LABEL[v.kind]}</span>
                      </span>
                      {v.status !== "booked" && <span className="text-xs text-muted">{STATUS_LABEL[v.status]}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={CARD} aria-labelledby="fortnight">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="fortnight" className="text-lg font-semibold">
              Next two weeks
            </h2>
            <Link href="/staff/schedule" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">
              Calendar
            </Link>
          </div>
          <p className="text-xs text-muted">How full each day is, 8am to 5pm.</p>
          <ul className="mt-3 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1.5" data-fortnight>
            {days.map((d) => {
              const full = Math.min(100, Math.round((d.minutes / (WORKDAY.end - WORKDAY.start)) * 100));
              return (
                <li key={d.day}>
                  <Link
                    href={`/staff/schedule?view=day&date=${d.day}`}
                    className="flex flex-col items-center gap-1 rounded-lg py-1 text-center transition-colors hover:bg-foreground/5"
                    aria-label={`${longDate(d.day)}: ${d.count} visit${d.count === 1 ? "" : "s"}, ${full}% full`}
                  >
                    <span className="text-[11px] text-muted">{SHORT_DAY.format(new Date(`${d.day}T12:00:00Z`))}</span>
                    <span className="relative h-14 w-full max-w-8 overflow-hidden rounded-md bg-background ring-1 ring-border">
                      <span className={`absolute inset-x-0 bottom-0 ${full >= 90 ? "bg-danger/70" : "bg-accent/70"}`} style={{ height: `${full}%` }} />
                    </span>
                    <span className="text-xs font-semibold">{Number(d.day.slice(8))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-6" aria-labelledby="money">
        <h2 id="money" className="text-lg font-semibold">
          The business
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-business>
          <Stat
            label="Taken this month"
            value={formatPence(snap.takenThisMonthPence)}
            detail={change === null ? "Invoices, call-outs and monthly payments" : `${change >= 0 ? "+" : ""}${change}% on last month (${formatPence(snap.takenLastMonthPence)})`}
            href="/staff/invoices?show=paid"
          />
          <Stat label="Owed to you" value={formatPence(Math.max(0, snap.owedPence))} detail={`${snap.unpaidCount} unpaid, plus what's left on monthly ones`} href="/staff/invoices" />
          <Stat
            label="Maintenance plan"
            value={`${snap.plan.members} member${snap.plan.members === 1 ? "" : "s"}`}
            detail={`About ${formatPence(snap.plan.monthlyPence)} a month${snap.plan.leaving ? ` · ${snap.plan.leaving} leaving` : ""}`}
            href="/staff/plan"
          />
          <Stat
            label="Reviews, 90 days"
            value={snap.reviews.average === null ? "None yet" : `${snap.reviews.average.toFixed(1)} ★`}
            detail={snap.reviews.count ? `${snap.reviews.count} review${snap.reviews.count === 1 ? "" : "s"}, ${snap.reviews.toGoogle} went on to Google` : "Asked for after each job"}
            href="/staff/customers"
          />
        </ul>
      </section>

      <section className={`mt-6 ${CARD}`} aria-labelledby="leads">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="leads" className="text-lg font-semibold">
            New jobs this month
          </h2>
          <Link href="/staff/messages?tab=jobs" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">
            All jobs
          </Link>
        </div>
        <p className="text-sm text-muted">
          {snap.leads.total} booking form{snap.leads.total === 1 ? "" : "s"}, {snap.leads.booked} booked in
          {snap.leads.total ? ` (${Math.round((snap.leads.booked / snap.leads.total) * 100)}%)` : ""}.
          {snap.quotes.open > 0 && (
            <>
              {" "}
              <Link href="/staff/quotes" className="font-semibold text-foreground underline underline-offset-4">
                {snap.quotes.open} quote{snap.quotes.open === 1 ? "" : "s"} out, worth {formatPence(snap.quotes.openPence)}
              </Link>
              .
            </>
          )}
        </p>
        {snap.leads.bySource.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5" data-lead-sources>
            {snap.leads.bySource.map((s) => (
              <li key={s.source} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 truncate">{s.source}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <span className="block h-full rounded-full bg-accent/70" style={{ width: `${Math.round((s.count / snap.leads.total) * 100)}%` }} />
                </span>
                <span className="w-8 text-right font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Shortcuts">
        {[
          { href: `/staff/schedule?view=day&date=${today}&add=1#add`, label: "Book a visit" },
          { href: "/staff/customers/new", label: "New customer" },
          { href: "/staff/quotes", label: "Quotes" },
          { href: "/staff/invoices", label: "Invoices" },
          { href: "/staff/plan", label: "Plan members" },
          ...(admin ? [{ href: "/staff/settings", label: "Settings and prices" }] : []),
        ].map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-foreground/40">
            {l.label}
          </Link>
        ))}
      </nav>

      <form action={logout} className="mt-8 sm:hidden">
        <button type="submit" className="min-h-11 rounded-full px-2 text-sm font-medium text-muted underline underline-offset-4">
          Log out
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <li>
      <Link href={href} className="block h-full rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-foreground/40">
        <span className="block text-xs text-muted">{label}</span>
        <span className="mt-1 block text-2xl font-bold tracking-tight">{value}</span>
        <span className="mt-1 block text-xs text-muted">{detail}</span>
      </Link>
    </li>
  );
}
