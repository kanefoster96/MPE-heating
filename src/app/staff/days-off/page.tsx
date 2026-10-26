import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { listDaysOff } from "@/lib/days-off";
import { appointmentsBetween } from "@/lib/appointments";
import { longDate } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { deleteDayOff, saveDayOff } from "./actions";

export const metadata: Metadata = { title: "Days off" };

const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

/**
 * Days off and holidays: customers can't ask for a visit on them (booking
 * forms, their account, pick-a-time and visit pages), and the schedule
 * greys them out. Anything already booked on one is listed so it can be
 * moved.
 */
export default async function DaysOffPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { done, error } = await searchParams;
  await requireStaff("/staff/days-off");
  const today = londonNow().dateISO;
  const days = await listDaysOff(today);
  const clashes = await Promise.all(
    days.map(async (d) => (await appointmentsBetween(d.startsOn, d.endsOn)).filter((a) => a.status === "booked" || a.status === "requested").length),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/staff/schedule" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Schedule
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Days off</h1>
      <p className="mt-1 text-sm text-muted">Holidays and days you&rsquo;re not working. Customers won&rsquo;t be offered them when they ask for a visit.</p>
      {done && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">Saved.</p>}
      {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}

      <form action={saveDayOff} className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2" data-day-off-form>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">First day</span>
          <input type="date" name="startsOn" required min={today} defaultValue={today} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Last day (blank for one day)</span>
          <input type="date" name="endsOn" min={today} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-muted">Note (only the team sees it)</span>
          <input name="note" maxLength={120} placeholder="e.g. Holiday" className={FIELD} />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90 sm:col-span-2 sm:justify-self-start">
          Add days off
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-2" data-days-off>
        {days.length === 0 && <li className="text-sm text-muted">None coming up.</li>}
        {days.map((d, i) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{d.startsOn === d.endsOn ? longDate(d.startsOn) : `${longDate(d.startsOn)} to ${longDate(d.endsOn)}`}</span>
              {d.note && <span className="text-muted"> · {d.note}</span>}
              {clashes[i] > 0 && (
                <Link href={`/staff/schedule?view=day&date=${d.startsOn}`} className="block text-xs font-semibold text-danger underline underline-offset-4">
                  {clashes[i]} visit{clashes[i] === 1 ? "" : "s"} already booked then: move {clashes[i] === 1 ? "it" : "them"}
                </Link>
              )}
            </span>
            <form action={deleteDayOff.bind(null, d.id)}>
              <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/10">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
