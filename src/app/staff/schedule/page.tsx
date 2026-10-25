import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { londonNow } from "@/lib/schedule-time";
import { appointmentsBetween, getAppointment, waitingOnTeam, type Appointment } from "@/lib/appointments";
import { business } from "@/lib/content";
import { viaPhrase } from "@/lib/visit-notify";
import { remindersSent } from "@/lib/follow-up-sweep";
import { PAID_VIA_LABEL, formatPence, invoiceNumber, paymentsForAppointments, type PaymentRequest } from "@/lib/payments";
import { requestedWhen } from "@/lib/visit-copy";
import { customerLabel, getCustomer, getCustomers, type Customer } from "@/lib/customers";
import { getEnquiry, visitKindFor, CATEGORY_LABEL } from "@/lib/enquiries";
import {
  APPOINTMENT_STATUSES,
  DAY_VIEW,
  KIND_DEFAULT_MINUTES,
  KIND_LABEL,
  KIND_STYLE,
  PART_LABEL,
  PART_WINDOW,
  STATUS_LABEL,
  isPart,
  WORKDAY,
  addDays,
  addMonths,
  clock,
  dayLoad,
  formatDuration,
  isISODate,
  isMonth,
  layoutColumns,
  longDate,
  monthGrid,
  monthLabel,
  windowLabel,
  type AppointmentKind,
} from "@/lib/day-plan";
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { AppointmentForm, type AppointmentFormValues } from "@/components/staff/appointment-form";
import {
  acceptVisitRequest,
  addAppointment,
  changeAppointmentStatus,
  editAppointment,
  keepVisitTime,
  removeAppointment,
  sendVisitDetails,
} from "./actions";
import { openCustomerChat } from "../customers/actions";

export const metadata: Metadata = { title: "Schedule" };

const SUCCESS: Record<string, string> = {
  added: "Visit added.",
  saved: "Visit saved.",
  accepted: "Booked.",
  sent: "Sent.",
  removed: "Visit removed.",
  finished: "Job done.",
};

/** "Visit added. Sent to them by message, email and text." */
function successLine(success: string, sent: string | undefined): string {
  const base = SUCCESS[success] ?? "Done.";
  if (!sent) return base;
  if (sent === "none") return `${base} We couldn't send them the details: add an email or mobile to their customer page.`;
  return `${base} They've been sent the details by ${viaPhrase(sent.split(","))}.`;
}

/** Pixels per hour on the day view's timeline. */
const HOUR_PX = 56;

type SearchParams = {
  view?: string;
  date?: string;
  month?: string;
  add?: string;
  edit?: string;
  start?: string;
  end?: string;
  customer?: string;
  enquiry?: string;
  /** Move a visit to the time its customer asked for. */
  to?: string;
  part?: string;
  error?: string;
  success?: string;
  sent?: string;
  note?: string;
};

function scheduleHref(params: Record<string, string | undefined>) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>;
  return `/staff/schedule?${new URLSearchParams(clean).toString()}`;
}

/** On the schedule: everything but cancelled visits. */
const live = (a: Appointment) => a.status !== "cancelled";
/** Taking up time: booked or done. A request doesn't until it's accepted. */
const counts = (a: Appointment) => a.status === "booked" || a.status === "done";

/**
 * The schedule: a month calendar showing how full each day is, and a day
 * view with every visit on a timeline, the free gaps in the working day, and
 * the visits' details below. Opening a day from the calendar opens its
 * schedule. Kanvas Academy's Full Calendar is the starting point (day by day,
 * open an item to act on it); MPE books visits by rough time window instead
 * of fixed class times.
 */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  await requireStaff("/staff/schedule");
  const today = londonNow().dateISO;
  const view = params.view === "day" || params.date ? "day" : "month";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">MPE team</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Schedule</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1" role="group" aria-label="View">
          <Link
            href={scheduleHref({ view: "day", date: isISODate(params.date) ? params.date : today })}
            aria-current={view === "day" ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium ${view === "day" ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
          >
            Day
          </Link>
          <Link
            href={scheduleHref({ view: "month", month: (isISODate(params.date) ? params.date : today).slice(0, 7) })}
            aria-current={view === "month" ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium ${view === "month" ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
          >
            Month
          </Link>
        </div>
      </div>

      {params.success && SUCCESS[params.success] && (
        <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success" data-flash>
          {params.success === "finished" && params.note ? params.note : successLine(params.success, params.sent)}
        </p>
      )}
      {params.error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}

      <Waiting today={today} />

      {view === "month" ? (
        <MonthView month={isMonth(params.month) ? params.month : today.slice(0, 7)} today={today} />
      ) : (
        <DayView day={isISODate(params.date) ? params.date : today} today={today} params={params} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month: every day's load at a glance. Each day opens its schedule.

async function MonthView({ month, today }: { month: string; today: string }) {
  const weeks = monthGrid(month);
  const first = weeks[0][0];
  const last = weeks[weeks.length - 1][6];
  const appointments = await appointmentsBetween(first, last);
  const customers = await getCustomers(appointments.map((a) => a.customerId).filter((id): id is string => !!id));
  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments) byDay.set(a.day, [...(byDay.get(a.day) ?? []), a]);

  const monthVisits = appointments.filter((a) => a.day.startsWith(month) && counts(a));
  const fullDays = weeks.flat().filter((d) => d.startsWith(month) && dayLoad((byDay.get(d) ?? []).filter(counts)).full).length;

  return (
    <section className="mt-6" aria-label={monthLabel(month)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={scheduleHref({ view: "month", month: addMonths(month, -1) })} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5">
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <h2 className="min-w-40 text-center text-lg font-semibold">{monthLabel(month)}</h2>
          <Link href={scheduleHref({ view: "month", month: addMonths(month, 1) })} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5">
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
          {month !== today.slice(0, 7) && (
            <Link href={scheduleHref({ view: "month" })} className="ml-1 inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-foreground/40">
              This month
            </Link>
          )}
        </div>
        <p className="text-sm text-muted" data-month-summary>
          {monthVisits.length} visit{monthVisits.length === 1 ? "" : "s"}
          {fullDays ? ` · ${fullDays} full day${fullDays === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-surface text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day, i) => {
            const items = (byDay.get(day) ?? []).filter(live);
            const load = dayLoad(items.filter(counts));
            const asks = items.filter((a) => a.status === "requested").length;
            const inMonth = day.startsWith(month);
            const isToday = day === today;
            const past = day < today;
            const freeMinutes = WORKDAY.end - WORKDAY.start - load.bookedMinutes;
            return (
              <Link
                key={day}
                href={scheduleHref({ view: "day", date: day })}
                data-day={day}
                data-full={load.full ? "1" : undefined}
                aria-label={`${longDate(day)}: ${items.length - asks ? `${items.length - asks} visit${items.length - asks === 1 ? "" : "s"}${load.full ? ", full" : `, ${formatDuration(freeMinutes)} free`}` : "nothing booked"}${asks ? `, ${asks} request${asks === 1 ? "" : "s"}` : ""}`}
                className={`group relative flex min-h-16 flex-col gap-1 border-border p-1.5 transition-colors hover:bg-surface sm:min-h-28 sm:p-2 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${inMonth ? "" : "bg-surface/60"} ${past ? "opacity-70" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold sm:text-sm ${isToday ? "bg-accent text-accent-foreground" : inMonth ? "" : "text-muted"}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {load.full ? (
                    <span className="hidden rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger sm:inline">Full</span>
                  ) : items.length > 0 ? (
                    <span className="hidden text-[10px] font-medium text-muted sm:inline">{formatDuration(freeMinutes)} free</span>
                  ) : null}
                </div>
                {items.length > 0 && (
                  <>
                    <div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                      <div className={`h-full rounded-full ${load.full ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.max(8, Math.round(load.share * 100))}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                      {items.slice(0, 4).map((a) => (
                        <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${a.status === "requested" ? REQUEST_DOT : KIND_STYLE[a.kind].dot}`} />
                      ))}
                    </div>
                    <ul className="hidden flex-col gap-0.5 sm:flex">
                      {items.slice(0, 3).map((a) => (
                        <li key={a.id} className="flex items-center gap-1 truncate text-[11px] leading-tight">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.status === "requested" ? REQUEST_DOT : KIND_STYLE[a.kind].dot}`} aria-hidden="true" />
                          <span className={`truncate ${a.status === "requested" ? "italic text-muted" : ""}`}>
                            {a.status === "requested" ? (a.part ? PART_LABEL[a.part] : "Asked") : clock(a.start)} {visitName(a, customers)}
                          </span>
                        </li>
                      ))}
                      {items.length > 3 && <li className="text-[11px] text-muted">+{items.length - 3} more</li>}
                    </ul>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <KindKey />
    </section>
  );
}

/** A customer's request: a hollow dot, until it's accepted. */
const REQUEST_DOT = "bg-background ring-[1.5px] ring-inset ring-foreground/60";

function KindKey() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Key">
      {(Object.keys(KIND_LABEL) as AppointmentKind[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${KIND_STYLE[k].dot}`} aria-hidden="true" />
          {KIND_LABEL[k]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${REQUEST_DOT}`} aria-hidden="true" />
        Requested
      </li>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Waiting on the team: customers' requests and asks to move, on top of both
// views so nothing sits unanswered.

async function Waiting({ today }: { today: string }) {
  const waiting = await waitingOnTeam(today);
  if (waiting.length === 0) return null;
  const customers = await getCustomers(waiting.map((a) => a.customerId).filter((id): id is string => !!id));
  return (
    <section className="mt-6 rounded-2xl border border-accent/40 bg-accent/5 p-4 sm:p-5" aria-labelledby="waiting" data-waiting>
      <h2 id="waiting" className="font-semibold">
        {waiting.length} waiting for you
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {waiting.map((a) => {
          const name = visitName(a, customers);
          const asked = a.status === "requested";
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3" data-waiting-item={asked ? "request" : "move"}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {name} · {KIND_LABEL[a.kind]}
                </p>
                <p className="text-sm text-muted">
                  {asked
                    ? `Asked for ${requestedWhen(a.day, a.part)}${a.part === "any" ? ", any time" : ""}`
                    : `${a.status === "no_access" ? `Missed on ${longDate(a.day)}` : `Can't make ${longDate(a.day)}`}. Asked for ${requestedWhen(a.change!.day, a.change!.part)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {asked && (
                  <form action={acceptVisitRequest.bind(null, a.id, a.day)}>
                    <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90">
                      Accept
                    </button>
                  </form>
                )}
                <Link
                  href={
                    scheduleHref(
                      asked
                        ? { view: "day", date: a.day, edit: a.id }
                        : { view: "day", date: a.change!.day, edit: a.id, to: a.change!.day, part: a.change!.part ?? "any" },
                    ) + "#add"
                  }
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-foreground/40"
                >
                  {asked ? "Change time" : "Move it"}
                </Link>
                <Link
                  href={scheduleHref({ view: "day", date: asked ? a.day : a.change!.day }) + `#visit-${a.id}`}
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
                >
                  See the day
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function visitName(a: Appointment, customers: Map<string, Customer>): string {
  const customer = a.customerId ? customers.get(a.customerId) : undefined;
  return customer ? customerLabel(customer) : a.title || KIND_LABEL[a.kind];
}

// ---------------------------------------------------------------------------
// Day: the timeline, the gaps, and each visit's details.

async function DayView({ day, today, params }: { day: string; today: string; params: SearchParams }) {
  const appointments = await appointmentsBetween(day, day);
  const customers = await getCustomers(appointments.map((a) => a.customerId).filter((id): id is string => !!id));
  const payments = await paymentsForAppointments(appointments.map((a) => a.id));
  const active = appointments.filter(live);
  const booked = active.filter(counts);
  const asks = active.length - booked.length;
  const load = dayLoad(booked);
  // The timeline marks free time around requests too, so a request sits in
  // its window rather than on top of a "Free" label.
  const timelineGaps = dayLoad(active).gaps;
  const editing = params.edit ? appointments.find((a) => a.id === params.edit) ?? (await getAppointment(params.edit)) : null;
  const adding = !editing && (params.add === "1" || !!params.customer || !!params.enquiry);
  // "Move it": start the form at the day and part of the day the customer asked for.
  const moveTo =
    editing && isISODate(params.to) && isPart(params.part)
      ? { day: params.to, start: PART_WINDOW[params.part].start, end: Math.min(PART_WINDOW[params.part].start + (editing.end - editing.start), PART_WINDOW[params.part].end) }
      : null;
  const addInitial = adding ? await addFormValues(day, params) : null;

  const viewStart = Math.min(DAY_VIEW.start, ...active.map((a) => Math.floor(a.start / 60) * 60));
  const viewEnd = Math.max(DAY_VIEW.end, ...active.map((a) => Math.ceil(a.end / 60) * 60));
  const top = (m: number) => ((m - viewStart) / 60) * HOUR_PX;
  const hours: number[] = [];
  for (let h = viewStart; h < viewEnd; h += 60) hours.push(h);

  return (
    <section className="mt-6" aria-label={longDate(day)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={scheduleHref({ view: "day", date: addDays(day, -1) })} aria-label="Previous day" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5">
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <h2 className="min-w-48 text-center text-lg font-semibold">
            {day === today ? "Today · " : ""}
            {longDate(day)}
          </h2>
          <Link href={scheduleHref({ view: "day", date: addDays(day, 1) })} aria-label="Next day" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5">
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
          {day !== today && (
            <Link href={scheduleHref({ view: "day", date: today })} className="ml-1 inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-foreground/40">
              Today
            </Link>
          )}
        </div>
        {!adding && !editing && (
          <Link
            href={scheduleHref({ view: "day", date: day, add: "1" }) + "#add"}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            + Add visit
          </Link>
        )}
      </div>

      <p className="mt-2 text-sm text-muted" data-day-summary>
        {booked.length === 0
          ? "Nothing booked. The whole day is free."
          : `${booked.length} visit${booked.length === 1 ? "" : "s"} · ${formatDuration(load.bookedMinutes)} booked of ${formatDuration(WORKDAY.end - WORKDAY.start)}`}
        {booked.length > 0 &&
          (load.full ? " · Full" : load.gaps.length ? ` · Free ${load.gaps.map((g) => windowLabel(g.start, g.end)).join(", ")}` : "")}
        {asks > 0 && ` · ${asks} request${asks === 1 ? "" : "s"} to answer`}
      </p>

      {(adding || editing) && (
        <div id="add" className="mt-4 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">
            {editing ? (editing.status === "requested" ? "Book this request" : moveTo ? "Move to the time they asked for" : "Edit visit") : "Add a visit"}
          </h3>
          {editing ? (
            <AppointmentForm
              key={[editing.id, params.to, params.part].join("|")}
              action={editAppointment.bind(null, editing.id)}
              initial={await editFormValues(editing)}
              startAt={moveTo ?? undefined}
              mode={editing.status === "requested" ? "request" : "edit"}
              phone={business.phoneDisplay}
              submitLabel={editing.status === "requested" ? "Book it" : "Save visit"}
              onCancelHref={scheduleHref({ view: "day", date: day })}
            />
          ) : (
            addInitial && (
              <AppointmentForm
                key={[day, params.start, params.end, params.customer, params.enquiry].join("|")}
                action={addAppointment}
                initial={addInitial}
                phone={business.phoneDisplay}
                submitLabel="Add visit"
                onCancelHref={scheduleHref({ view: "day", date: day })}
              />
            )
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* The timeline. Gaps in the working day link to a new visit in that window. */}
        <div className="relative self-start rounded-2xl border border-border bg-background lg:sticky lg:top-20" style={{ height: hours.length * HOUR_PX }} data-timeline>
          <div
            className="absolute inset-x-0 bg-surface"
            style={{ top: top(WORKDAY.start), height: ((WORKDAY.end - WORKDAY.start) / 60) * HOUR_PX }}
            aria-hidden="true"
          />
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 border-t border-border/70 first:border-t-0" style={{ top: top(h) }} aria-hidden="true">
              <span className="absolute left-2 top-0.5 text-[11px] text-muted">{clock(h)}</span>
            </div>
          ))}
          <div className="absolute inset-y-0 left-14 right-2">
            {timelineGaps.map((g) => (
              <Link
                key={g.start}
                href={scheduleHref({ view: "day", date: day, add: "1", start: String(g.start), end: String(g.end) }) + "#add"}
                className="absolute inset-x-0 flex items-center justify-center rounded-lg border border-dashed border-success/50 text-xs font-medium text-success transition-colors hover:bg-success/5"
                style={{ top: top(g.start) + 2, height: ((g.end - g.start) / 60) * HOUR_PX - 4 }}
                data-gap
              >
                Free {windowLabel(g.start, g.end)}
              </Link>
            ))}
            {layoutColumns(active).map(({ item: a, column, columns }) => (
              <a
                key={a.id}
                href={`#visit-${a.id}`}
                className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-xs leading-tight shadow-sm transition-shadow hover:shadow-md ${
                  a.status === "requested" ? "border-dashed border-foreground/50 bg-background/90" : KIND_STYLE[a.kind].block
                } ${a.status === "done" || a.status === "no_access" ? "opacity-60" : ""}`}
                style={{
                  top: top(a.start) + 1,
                  height: Math.max(28, ((a.end - a.start) / 60) * HOUR_PX - 2),
                  left: `${(column / columns) * 100}%`,
                  width: `calc(${100 / columns}% - 4px)`,
                }}
                data-block={a.kind}
              >
                <span className="block truncate font-semibold">{visitName(a, customers)}</span>
                <span className="block truncate text-muted">
                  {a.status === "requested" ? `Requested · ${KIND_LABEL[a.kind]}` : `${KIND_LABEL[a.kind]} · ${windowLabel(a.start, a.end)}`}
                  {a.status === "done" ? " · Done" : a.status === "no_access" ? " · Not in" : ""}
                  {a.change ? " · Wants to move" : ""}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {appointments.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted">
              No visits yet. Add one, or tap a free slot on the timeline.
            </p>
          ) : (
            appointments.map((a) => (
              <VisitCard key={a.id} appointment={a} customer={a.customerId ? customers.get(a.customerId) : undefined} payments={payments.get(a.id) ?? []} />
            ))
          )}
          <KindKey />
        </div>
      </div>
    </section>
  );
}

const SENT_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const PILL = "inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-foreground/40";

function VisitCard({ appointment: a, customer, payments }: { appointment: Appointment; customer: Customer | undefined; payments: PaymentRequest[] }) {
  const place = [a.address, a.postcode].filter(Boolean).join(", ");
  const requested = a.status === "requested";
  const firstName = customer?.name?.split(" ")[0] ?? "them";
  return (
    <article
      id={`visit-${a.id}`}
      className={`scroll-mt-20 rounded-2xl border p-4 ${requested ? "border-dashed border-foreground/40 bg-background" : "border-border bg-surface"} ${a.status === "cancelled" ? "opacity-60" : ""}`}
      data-visit={a.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[a.kind].block}`}>{KIND_LABEL[a.kind]}</span>
            <span className="font-semibold">{requested ? `Asked for ${a.part ? PART_LABEL[a.part].toLowerCase() : windowLabel(a.start, a.end)}` : windowLabel(a.start, a.end)}</span>
            {requested && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold">Request</span>}
          </p>
          <p className={`mt-1 truncate font-semibold ${a.status === "cancelled" ? "line-through" : ""}`}>
            {customer ? (
              <Link href={`/staff/customers/${customer.id}`} className="underline-offset-4 hover:underline">
                {customerLabel(customer)}
              </Link>
            ) : (
              a.title || "No customer"
            )}
          </p>
          {customer && a.title && <p className="text-sm text-muted">{a.title}</p>}
        </div>
        <Link href={scheduleHref({ view: "day", date: a.day, edit: a.id }) + "#add"} className={PILL}>
          {requested ? "Change time" : "Edit"}
        </Link>
      </div>

      {a.change && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5 text-sm" data-change-request>
          <p className="font-semibold">
            {firstName === "them" ? "They" : firstName} {a.status === "no_access" ? "asked us back on" : "can't make this. Asked for"} {requestedWhen(a.change.day, a.change.part)}
            {a.change.part === "any" ? ", any time" : ""}.
          </p>
          {a.change.note && <p className="mt-1 text-muted">&ldquo;{a.change.note}&rdquo;</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href={scheduleHref({ view: "day", date: a.change.day, edit: a.id, to: a.change.day, part: a.change.part ?? "any" }) + "#add"}
              className="inline-flex min-h-9 items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
            >
              Move it
            </Link>
            <form action={keepVisitTime.bind(null, a.id, a.day)}>
              <button type="submit" className={PILL}>
                Keep this time
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1 text-sm">
        {place && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
          >
            <MapPinIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {place}
          </a>
        )}
        {customer?.phone && (
          <a href={`tel:${customer.phoneE164 ?? customer.phone}`} className="inline-flex min-h-9 items-center gap-1.5 underline-offset-4 hover:underline">
            <PhoneIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {customer.phone}
          </a>
        )}
        {customer && (customer.boilerMake || customer.boilerModel) && (
          <p className="text-muted">Boiler: {[customer.boilerMake, customer.boilerModel, customer.boilerAge].filter(Boolean).join(" · ")}</p>
        )}
        {customer?.accessNotes && <p className="text-muted">Access: {customer.accessNotes}</p>}
        {a.notes && <p className="whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-foreground">{a.notes}</p>}
        {a.status === "done" && customer && (
          <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2" data-job-report>
            <p className="text-xs font-semibold text-success">What we did</p>
            <p className="whitespace-pre-wrap text-foreground">{a.jobReport || "Not written yet."}</p>
            <Link href={`/staff/jobs/${a.id}/finish`} className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold underline underline-offset-4">
              {a.jobReport ? "Edit" : "Add what we did"}
            </Link>
          </div>
        )}
      </div>

      {requested ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <form action={acceptVisitRequest.bind(null, a.id, a.day)}>
            <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90">
              Accept and let {firstName} know
            </button>
          </form>
          {customer && (
            <form action={openCustomerChat.bind(null, customer.id)}>
              <button type="submit" className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold hover:border-foreground/40">
                Message
              </button>
            </form>
          )}
          <form action={changeAppointmentStatus.bind(null, a.id, "cancelled", a.day)}>
            <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-foreground">
              Decline
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {APPOINTMENT_STATUSES.map((status) =>
            // Done opens the finish screen (what was done, notes, summary, review).
            status === "done" && a.status !== "done" && customer ? (
              <Link
                key={status}
                href={`/staff/jobs/${a.id}/finish`}
                className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:border-foreground/40"
              >
                {STATUS_LABEL[status]}
              </Link>
            ) : (
            <form key={status} action={changeAppointmentStatus.bind(null, a.id, status, a.day)}>
              <button
                type="submit"
                aria-pressed={a.status === status}
                className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                  a.status === status ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:border-foreground/40"
                }`}
              >
                {STATUS_LABEL[status]}
              </button>
            </form>
            ),
          )}
          {a.status === "cancelled" && (
            <form action={removeAppointment.bind(null, a.id, a.day)} className="ml-auto">
              <button type="submit" className="min-h-9 rounded-full px-3 text-xs font-medium text-danger hover:bg-danger/10">
                Remove
              </button>
            </form>
          )}
        </div>
      )}

      {customer && !requested && a.status !== "cancelled" && <PaymentLine appointment={a} payments={payments} />}
      {customer && !requested && <NoticeLine appointment={a} firstName={firstName} />}
    </article>
  );
}

/** The visit's call-out fee and invoices, and Take payment. */
function PaymentLine({ appointment: a, payments }: { appointment: Appointment; payments: PaymentRequest[] }) {
  const shown = payments.filter((p) => p.status !== "cancelled");
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm" data-payment-line>
      <ul className="flex flex-col gap-0.5">
        {shown.length === 0 ? (
          <li className="text-xs text-muted">Nothing taken yet.</li>
        ) : (
          shown.map((p) => (
            <li key={p.id} className="text-xs">
              <span className="font-semibold">{p.kind === "callout_fee" ? "Call-out fee" : invoiceNumber(p.number)}</span> {formatPence(p.amountPence)} ·{" "}
              <span className={p.status === "paid" ? "font-medium text-success" : "text-muted"}>
                {p.status === "paid" ? `Paid ✓${p.paidVia ? ` ${PAID_VIA_LABEL[p.paidVia]}` : ""}` : "Waiting"}
              </span>
              {p.offers.some((o) => o.taken) && (
                <span className="ml-1 font-semibold text-accent">+ {p.offers.filter((o) => o.taken).map((o) => o.label.toLowerCase()).join(", ")}</span>
              )}
            </li>
          ))
        )}
      </ul>
      <Link href={`/staff/payments/new?visit=${a.id}`} className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
        Take payment
      </Link>
    </div>
  );
}

/**
 * What the customer's been told and the automatic reminders they've had,
 * and the button to tell them (again).
 */
function NoticeLine({ appointment: a, firstName }: { appointment: Appointment; firstName: string }) {
  const told =
    a.notifiedAt && a.lastNotice
      ? `${a.lastNotice === "cancelled" ? "Told it's cancelled" : a.lastNotice === "moved" ? "Sent the new time" : "Sent the details"}${a.notifiedVia.length ? ` by ${viaPhrase(a.notifiedVia)}` : ""} · ${SENT_TIME.format(new Date(a.notifiedAt))}`
      : null;
  const reminders = remindersSent(a);
  const upcoming = a.status === "booked" && !a.hourRemindedAt;
  const button =
    a.status === "cancelled"
      ? a.notifiedAt && a.lastNotice !== "cancelled"
        ? `Tell ${firstName} it's cancelled`
        : null
      : a.status === "no_access"
        ? a.missedFollowupAt || a.change
          ? null
          : "Offer another time now"
        : a.status === "booked"
          ? told
            ? "Send again"
            : `Send ${firstName} the details`
          : null;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted" data-notice-line>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {told ??
            (a.status === "booked"
              ? `${firstName === "them" ? "They haven't" : `${firstName} hasn't`} been sent the details yet.`
              : a.status === "no_access" && !a.missedFollowupAt && !a.change
                ? "They'll be offered another time at midday tomorrow."
                : "")}
        </span>
        {button && (
          <form action={sendVisitDetails.bind(null, a.id, a.day)}>
            <button type="submit" className={PILL}>
              {button}
            </button>
          </form>
        )}
      </div>
      {(reminders.length > 0 || upcoming) && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1" data-reminders>
          {reminders.map((r) => (
            <li key={r.label}>
              ✓ {r.label} · {SENT_TIME.format(new Date(r.at))}
            </li>
          ))}
          {upcoming && (
            <li>
              Automatic: {a.remindedAt ? "" : "reminder the evening before, "}message an hour before
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form starting values: a free slot, a customer, or a booking form to book.

async function addFormValues(day: string, params: SearchParams): Promise<AppointmentFormValues> {
  const enquiry = params.enquiry ? await getEnquiry(params.enquiry) : null;
  const customerId = params.customer ?? enquiry?.customerId ?? null;
  const customer = customerId ? await getCustomer(customerId) : null;
  const kind: AppointmentKind = enquiry ? visitKindFor(enquiry.category) : "callout";

  const slotStart = Number(params.start);
  const slotEnd = Number(params.end);
  const hasSlot = Number.isInteger(slotStart) && Number.isInteger(slotEnd) && slotEnd > slotStart && slotStart >= 0 && slotEnd <= 1440;
  const start = hasSlot ? slotStart : WORKDAY.start;
  const end = hasSlot ? Math.min(slotEnd, start + KIND_DEFAULT_MINUTES[kind]) : start + KIND_DEFAULT_MINUTES[kind];

  const enquiryNotes = enquiry
    ? [
        `${CATEGORY_LABEL[enquiry.category]} booking${enquiry.sameDay ? " (same day requested)" : ""}`,
        ...enquiry.answers.filter((a) => a.q !== "Postcode").map((a) => `${a.q}: ${a.a}`),
        ...(enquiry.message && !enquiry.answers.some((a) => a.a === enquiry.message) ? [enquiry.message] : []),
      ].join("\n")
    : "";

  return {
    kind,
    day,
    start,
    end: Math.min(end, 24 * 60),
    customer: customer ? { id: customer.id, label: customerLabel(customer) } : null,
    enquiryId: enquiry?.id ?? null,
    title: "",
    address: customer?.address ?? "",
    postcode: customer?.postcode ?? enquiry?.postcode ?? "",
    notes: enquiryNotes,
  };
}

async function editFormValues(a: Appointment): Promise<AppointmentFormValues> {
  const customer = a.customerId ? await getCustomer(a.customerId) : null;
  return {
    kind: a.kind,
    day: a.day,
    start: a.start,
    end: a.end,
    customer: customer ? { id: customer.id, label: customerLabel(customer) } : null,
    enquiryId: a.enquiryId,
    title: a.title ?? "",
    address: a.address ?? "",
    postcode: a.postcode ?? "",
    notes: a.notes ?? "",
  };
}
