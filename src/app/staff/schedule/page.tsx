import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { londonNow } from "@/lib/schedule-time";
import { appointmentsBetween, getAppointment, type Appointment } from "@/lib/appointments";
import { customerLabel, getCustomer, getCustomers, type Customer } from "@/lib/customers";
import { getEnquiry, visitKindFor, CATEGORY_LABEL } from "@/lib/enquiries";
import {
  APPOINTMENT_STATUSES,
  DAY_VIEW,
  KIND_DEFAULT_MINUTES,
  KIND_LABEL,
  KIND_STYLE,
  STATUS_LABEL,
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
  type AppointmentStatus,
} from "@/lib/day-plan";
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { AppointmentForm, type AppointmentFormValues } from "@/components/staff/appointment-form";
import { addAppointment, changeAppointmentStatus, editAppointment, removeAppointment } from "./actions";

export const metadata: Metadata = { title: "Schedule" };

const SUCCESS: Record<string, string> = {
  added: "Visit added.",
  saved: "Visit saved.",
  removed: "Visit removed.",
};

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
  error?: string;
  success?: string;
};

function scheduleHref(params: Record<string, string | undefined>) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>;
  return `/staff/schedule?${new URLSearchParams(clean).toString()}`;
}

const live = (a: Appointment) => a.status !== "cancelled";

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
        <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">{SUCCESS[params.success]}</p>
      )}
      {params.error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}

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

  const monthVisits = appointments.filter((a) => a.day.startsWith(month) && live(a));
  const fullDays = weeks.flat().filter((d) => d.startsWith(month) && dayLoad((byDay.get(d) ?? []).filter(live)).full).length;

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
            const load = dayLoad(items);
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
                aria-label={`${longDate(day)}: ${items.length ? `${items.length} visit${items.length === 1 ? "" : "s"}${load.full ? ", full" : `, ${formatDuration(freeMinutes)} free`}` : "nothing booked"}`}
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
                        <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[a.kind].dot}`} />
                      ))}
                    </div>
                    <ul className="hidden flex-col gap-0.5 sm:flex">
                      {items.slice(0, 3).map((a) => (
                        <li key={a.id} className="flex items-center gap-1 truncate text-[11px] leading-tight">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_STYLE[a.kind].dot}`} aria-hidden="true" />
                          <span className="truncate">
                            {clock(a.start)} {visitName(a, customers)}
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

function KindKey() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Key">
      {(Object.keys(KIND_LABEL) as AppointmentKind[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${KIND_STYLE[k].dot}`} aria-hidden="true" />
          {KIND_LABEL[k]}
        </li>
      ))}
    </ul>
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
  const active = appointments.filter(live);
  const load = dayLoad(active);
  const editing = params.edit ? appointments.find((a) => a.id === params.edit) ?? (await getAppointment(params.edit)) : null;
  const adding = !editing && (params.add === "1" || !!params.customer || !!params.enquiry);
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
        {active.length === 0
          ? "Nothing booked. The whole day is free."
          : `${active.length} visit${active.length === 1 ? "" : "s"} · ${formatDuration(load.bookedMinutes)} booked of ${formatDuration(WORKDAY.end - WORKDAY.start)}`}
        {active.length > 0 &&
          (load.full ? " · Full" : load.gaps.length ? ` · Free ${load.gaps.map((g) => windowLabel(g.start, g.end)).join(", ")}` : "")}
      </p>

      {(adding || editing) && (
        <div id="add" className="mt-4 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">{editing ? "Edit visit" : "Add a visit"}</h3>
          {editing ? (
            <AppointmentForm
              key={editing.id}
              action={editAppointment.bind(null, editing.id)}
              initial={await editFormValues(editing)}
              submitLabel="Save visit"
              onCancelHref={scheduleHref({ view: "day", date: day })}
            />
          ) : (
            addInitial && (
              <AppointmentForm
                key={[day, params.start, params.end, params.customer, params.enquiry].join("|")}
                action={addAppointment}
                initial={addInitial} submitLabel="Add visit" onCancelHref={scheduleHref({ view: "day", date: day })} />
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
            {load.gaps.map((g) => (
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
                className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-xs leading-tight shadow-sm transition-shadow hover:shadow-md ${KIND_STYLE[a.kind].block} ${a.status === "done" ? "opacity-60" : ""}`}
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
                  {KIND_LABEL[a.kind]} · {windowLabel(a.start, a.end)}
                  {a.status === "done" ? " · Done" : ""}
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
            appointments.map((a) => <VisitCard key={a.id} appointment={a} customer={a.customerId ? customers.get(a.customerId) : undefined} />)
          )}
          <KindKey />
        </div>
      </div>
    </section>
  );
}

function VisitCard({ appointment: a, customer }: { appointment: Appointment; customer: Customer | undefined }) {
  const place = [a.address, a.postcode].filter(Boolean).join(", ");
  return (
    <article id={`visit-${a.id}`} className={`scroll-mt-20 rounded-2xl border bg-surface p-4 ${a.status === "cancelled" ? "border-border opacity-60" : "border-border"}`} data-visit={a.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[a.kind].block}`}>{KIND_LABEL[a.kind]}</span>
            <span className="font-semibold">{windowLabel(a.start, a.end)}</span>
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
        <Link
          href={scheduleHref({ view: "day", date: a.day, edit: a.id }) + "#add"}
          className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-foreground/40"
        >
          Edit
        </Link>
      </div>

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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {APPOINTMENT_STATUSES.map((status: AppointmentStatus) => (
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
        ))}
        {a.status === "cancelled" && (
          <form action={removeAppointment.bind(null, a.id, a.day)} className="ml-auto">
            <button type="submit" className="min-h-9 rounded-full px-3 text-xs font-medium text-danger hover:bg-danger/10">
              Remove
            </button>
          </form>
        )}
      </div>
    </article>
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
