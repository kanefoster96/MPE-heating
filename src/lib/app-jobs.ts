import type { User } from "@supabase/supabase-js";
import { CLUB_SITE_URL } from "@/lib/club";
import { customerForUser, getCustomer, getCustomers, type Customer } from "@/lib/customers";
import { appointmentsBetween, appointmentsForCustomer, getAppointment, returnVisitFor, waitingOnTeamCount, type Appointment } from "@/lib/appointments";
import { KIND_LABEL, addDays, longDate, windowLabel } from "@/lib/day-plan";
import { requestedWhen, whenLine } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import {
  PAID_VIA_LABEL,
  formatPence,
  invoiceNumber,
  payLink,
  paymentsForAppointments,
  paymentsForCustomer,
  partPaymentsFor,
  paymentsOn,
  savedCardFor,
  type PaymentRequest,
} from "@/lib/payments";
import { quoteLink, quoteNumber, quoteOpen, quotesForCustomer } from "@/lib/quotes";
import { filesForCustomer } from "@/lib/job-files";
import { CATEGORY_LABEL, enquiriesForCustomer } from "@/lib/enquiries";
import { arrivalClock, visitLink } from "@/lib/visit-notify";
import { bookedPerDay } from "@/lib/dashboard";
import { closedDays } from "@/lib/days-off";

/**
 * The app's Jobs tab (mobile/app/(tabs)/jobs.tsx), built fresh from the
 * records each time, nothing stored.
 *
 * A customer's job starts when there's something real: a call-out or
 * service booking form they sent, a visit the team booked, or a quote. A chat message alone
 * stays in chat until the team books it. Each job shows its steps:
 * requested, booked (when), on the way (from the engineer's "on my way"),
 * done (with what was done), and paid. A job finished today stays at the
 * top for the rest of the day, then moves to Previous jobs, which is the
 * boiler's history.
 *
 * For the team, the same tab is the day's jobs: who, where, when, and the
 * buttons for the visit (call, directions, on my way, not in, finish).
 */

const SITE = CLUB_SITE_URL.replace(/\/$/, "");

export type JobStep = { label: string; detail?: string; state: "done" | "now" | "next" };
export type JobAction = { label: string; url: string; primary?: boolean };
export type JobCard = {
  id: string;
  title: string;
  when: string;
  /** "underway" is today's, on its way or in progress: the green card. */
  status: "underway" | "booked" | "requested" | "waiting" | "missed" | "done";
  statusLabel: string;
  steps: JobStep[];
  report: string | null;
  actions: JobAction[];
  sortKey: string;
};

const STATUS_LABEL: Record<JobCard["status"], string> = {
  underway: "Today",
  booked: "Booked",
  requested: "Requested",
  waiting: "Waiting on you",
  missed: "Missed",
  done: "Done",
};

function paymentStep(payments: PaymentRequest[]): { step: JobStep; action?: JobAction } | null {
  const live = payments.filter((p) => p.status !== "cancelled");
  if (!live.length) return null;
  const open = live.find((p) => p.status === "open" && p.planStatus !== "active");
  if (open) {
    return {
      step: { label: "Pay", detail: open.kind === "callout_fee" ? `${formatPence(open.amountPence)} call-out fee` : `${formatPence(open.amountPence)} (${invoiceNumber(open.number)})`, state: "now" },
      action: { label: `Pay ${formatPence(open.amountPence)}`, url: payLink(open), primary: true },
    };
  }
  const monthly = live.find((p) => p.planStatus === "active");
  if (monthly) return { step: { label: "Paying monthly", detail: invoiceNumber(monthly.number), state: "done" }, action: { label: "Monthly payments", url: payLink(monthly) } };
  return { step: { label: "Paid", state: "done" }, action: { label: "Receipt", url: payLink(live[0]) } };
}

function visitCard(v: Appointment, today: string, payments: PaymentRequest[], hasFiles: boolean, returnVisit: Appointment | null = null): JobCard {
  // Not fixed first time: we found the fault and we're coming back (a part to fit).
  const comingBack = v.status === "done" && v.outcome === "return" && returnVisit?.status !== "done";
  const done = v.status === "done";
  const steps: JobStep[] = [];
  if (v.source !== "team" || v.status === "requested") steps.push({ label: "Requested", detail: longDate(v.createdAt.slice(0, 10)), state: "done" });
  if (v.status === "requested") {
    steps.push({
      label: "Booking a time",
      detail: v.day < today ? `Sorry, we didn't get to you on ${requestedWhen(v.day, v.part)}. Pick another day that suits.` : `You asked for ${requestedWhen(v.day, v.part)}. We'll confirm it.`,
      state: "now",
    });
  }
  else steps.push({ label: "Booked", detail: whenLine(v), state: "done" });
  if (v.status === "no_access") {
    steps.push({ label: "We couldn't get in", detail: "Pick another time and we'll come back.", state: "now" });
  } else if (v.status !== "requested") {
    steps.push(
      v.onMyWayAt
        ? { label: "On the way", detail: `Arriving around ${arrivalClock(v.onMyWayAt, v.onMyWayEta ?? 30)}`, state: "done" }
        : { label: "On the way", detail: done ? undefined : "We'll text you when we set off.", state: done ? "done" : v.day === today ? "now" : "next" },
    );
  }
  if (comingBack) {
    steps.push({ label: "We found the fault", detail: v.completedAt ? longDate(v.completedAt.slice(0, 10)) : undefined, state: "done" });
    steps.push(
      returnVisit
        ? { label: "Coming back", detail: `${v.returnNote ? `To ${v.returnNote.replace(/\.$/, "")}: ` : ""}${whenLine(returnVisit)}`, state: "now" }
        : { label: "Coming back", detail: `${v.returnNote ? `To ${v.returnNote.replace(/\.$/, "")}. ` : ""}We'll be in touch to book a time.`, state: "now" },
    );
  } else {
    steps.push(done ? { label: "Job done", detail: v.completedAt ? longDate(v.completedAt.slice(0, 10)) : undefined, state: "done" } : { label: "Job done", state: "next" });
  }
  const pay = done ? paymentStep(payments) : null;
  if (pay) steps.push(pay.step);

  const actions: JobAction[] = [];
  if (pay?.action) actions.push(pay.action);
  if (v.status === "no_access") actions.push({ label: "Pick another time", url: visitLink(v), primary: true });
  if (v.status === "requested" && v.day < today) actions.push({ label: "Pick another day", url: `${visitLink(v)}#another-time`, primary: true });
  actions.push({ label: "Visit details", url: visitLink(v) });
  if (hasFiles) actions.push({ label: "Certificates and photos", url: `${SITE}/account#files` });

  const status: JobCard["status"] = comingBack
    ? "booked"
    : done
    ? "done"
    : v.status === "no_access"
      ? "missed"
      : v.status === "requested"
        ? "requested"
        : v.day === today || v.onMyWayAt
          ? "underway"
          : "booked";
  return {
    id: `visit-${v.id}`,
    title: v.followUpOf ? `Return visit${v.title?.trim() ? `: ${v.title.trim()}` : ""}` : v.title?.trim() || KIND_LABEL[v.kind],
    when: v.status === "requested" ? `Asked for ${requestedWhen(v.day, v.part)}` : whenLine(v),
    status,
    statusLabel: comingBack ? "Coming back" : STATUS_LABEL[status],
    steps,
    report: v.jobReport,
    actions,
    sortKey: `${v.day}-${String(v.start).padStart(4, "0")}`,
  };
}

export async function customerJobs(user: User): Promise<{ active: JobCard[]; previous: JobCard[] }> {
  if (user.is_anonymous) return { active: [], previous: [] };
  const customer = await customerForUser(user.id, user.email);
  if (!customer) return { active: [], previous: [] };
  const today = londonNow().dateISO;
  const [visits, payments, quotes, files, enquiries] = await Promise.all([
    appointmentsForCustomer(customer.id),
    paymentsForCustomer(customer.id),
    quotesForCustomer(customer.id),
    filesForCustomer(customer.id, { sharedOnly: true }).catch(() => []),
    enquiriesForCustomer(customer.id).catch(() => []),
  ]);
  const byVisit = new Map<string, PaymentRequest[]>();
  for (const p of payments) if (p.appointmentId) byVisit.set(p.appointmentId, [...(byVisit.get(p.appointmentId) ?? []), p]);
  const filesByVisit = new Set(files.map((f) => f.appointmentId).filter(Boolean));

  const active: JobCard[] = [];
  const previous: JobCard[] = [];
  for (const v of visits) {
    if (v.status === "cancelled") continue;
    const returnVisit = visits.find((r) => r.followUpOf === v.id && r.status !== "cancelled") ?? null;
    const card = visitCard(v, today, byVisit.get(v.id) ?? [], filesByVisit.has(v.id), returnVisit);
    // Finished today: stays up top for the rest of the day. Coming back: up top until the return visit's done.
    const waitingReturn = v.status === "done" && v.outcome === "return" && returnVisit?.status !== "done";
    const isActive = waitingReturn || (v.status === "done" ? v.day >= today : v.day >= today || v.status === "no_access" || v.status === "requested");
    (isActive ? active : previous).push(card);
  }

  // A booking form with no visit yet: "we've got it", and their link to pick
  // a time. Only real bookings (a call-out or a service): a new boiler or
  // commercial quote request, a plan question or anything else stays in
  // chat until a visit's booked or a quote's sent.
  const booked = new Set(visits.map((v) => v.enquiryId).filter(Boolean));
  const monthAgo = addDays(today, -30);
  for (const e of enquiries) {
    if (e.category !== "callout" && e.category !== "service") continue;
    if (booked.has(e.id) || (e.status !== "new" && e.status !== "contacted") || e.createdAt.slice(0, 10) < monthAgo) continue;
    active.push({
      id: `request-${e.id}`,
      title: CATEGORY_LABEL[e.category],
      when: `Sent ${longDate(e.createdAt.slice(0, 10))}`,
      status: "requested",
      statusLabel: STATUS_LABEL.requested,
      steps: [
        { label: "Request received", detail: e.sameDay ? "You asked for today." : undefined, state: "done" },
        { label: "Booking a time", detail: "We'll be in touch, or pick a time yourself.", state: "now" },
        { label: "Visit", state: "next" },
        { label: "Job done", state: "next" },
      ],
      report: null,
      actions: [{ label: "Pick a time", url: `${SITE}/request/${e.publicToken}`, primary: true }],
      sortKey: e.createdAt.slice(0, 10),
    });
  }

  // A quote waiting on their answer, or accepted and waiting for the install to be booked.
  for (const q of quotes) {
    const accepted = q.status === "accepted" && !!q.acceptedAt && q.acceptedAt.slice(0, 10) >= monthAgo;
    const installBooked = accepted && visits.some((v) => v.kind === "install" && v.status !== "cancelled" && v.createdAt >= q.acceptedAt!);
    if (!quoteOpen(q) && !(accepted && !installBooked)) continue;
    active.push({
      id: `quote-${q.id}`,
      title: q.title,
      when: `${quoteNumber(q.number)}: ${formatPence(q.totalPence)}`,
      status: accepted ? "booked" : "waiting",
      statusLabel: accepted ? "Accepted" : STATUS_LABEL.waiting,
      steps: [
        { label: "Quote sent", detail: q.sentAt ? longDate(q.sentAt.slice(0, 10)) : undefined, state: "done" },
        accepted ? { label: "Accepted", detail: longDate(q.acceptedAt!.slice(0, 10)), state: "done" } : { label: "Your answer", detail: `Valid until ${longDate(q.validUntil)}`, state: "now" },
        { label: "Booking the work", detail: accepted ? "We'll be in touch to book it in." : undefined, state: accepted ? "now" : "next" },
        { label: "Job done", state: "next" },
      ],
      report: null,
      actions: [{ label: accepted ? "Your quote" : `View quote, ${formatPence(q.totalPence)}`, url: quoteLink(q), primary: !accepted }],
      sortKey: (q.sentAt ?? q.createdAt).slice(0, 10),
    });
  }

  // Today's first, then the soonest; history newest first.
  const rank: Record<JobCard["status"], number> = { underway: 0, missed: 1, waiting: 2, booked: 3, requested: 4, done: 5 };
  active.sort((a, b) => rank[a.status] - rank[b.status] || a.sortKey.localeCompare(b.sortKey));
  previous.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return { active, previous: previous.slice(0, 50) };
}

// ---------------------------------------------------------------------------
// The team's day.

export type StaffJob = {
  id: string;
  kind: string;
  title: string | null;
  status: Appointment["status"];
  window: string;
  start: number;
  end: number;
  customer: { name: string | null; phone: string | null; conversationId: string | null } | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  onMyWay: string | null;
  changeRequested: boolean;
  openPayment: { id: string; amount: string } | null;
  paid: boolean;
};

export type StaffDay = {
  day: string;
  label: string;
  closed: string | null | false;
  jobs: StaffJob[];
  strip: { day: string; count: number; closed: boolean }[];
  waiting: number;
};

export async function staffDay(dayParam: string | null): Promise<StaffDay> {
  const today = londonNow().dateISO;
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
  const [visits, perDay, closed, waiting] = await Promise.all([
    appointmentsBetween(day, day),
    bookedPerDay(today, 14),
    closedDays(today, addDays(today, 13)).catch(() => new Map<string, string | null>()),
    waitingOnTeamCount(today).catch(() => 0),
  ]);
  const shown = visits.filter((v) => v.status !== "cancelled").sort((a, b) => a.start - b.start);
  const [customers, payments] = await Promise.all([
    getCustomers(shown.map((v) => v.customerId).filter((id): id is string => !!id)),
    paymentsForAppointments(shown.map((v) => v.id)),
  ]);
  const dayClosed = (await closedDays(day, day).catch(() => new Map<string, string | null>())).get(day);
  return {
    day,
    label: day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : longDate(day),
    closed: dayClosed === undefined ? false : dayClosed,
    waiting,
    strip: perDay.map((d) => ({ day: d.day, count: d.count, closed: closed.has(d.day) })),
    jobs: shown.map((v) => toStaffJob(v, v.customerId ? customers.get(v.customerId) : undefined, payments.get(v.id) ?? [])),
  };
}

function toStaffJob(v: Appointment, c: Customer | undefined, payments: PaymentRequest[]): StaffJob {
  const ps = payments.filter((p) => p.status !== "cancelled");
  const open = ps.find((p) => p.status === "open");
  return {
    id: v.id,
    kind: KIND_LABEL[v.kind],
    title: v.title,
    status: v.status,
    window: windowLabel(v.start, v.end),
    start: v.start,
    end: v.end,
    customer: c ? { name: c.name, phone: c.phoneE164 ?? c.phone, conversationId: c.conversationId } : null,
    address: v.address ?? c?.address ?? null,
    postcode: v.postcode ?? c?.postcode ?? null,
    notes: v.notes,
    onMyWay: v.onMyWayAt ? arrivalClock(v.onMyWayAt, v.onMyWayEta ?? 30) : null,
    changeRequested: !!v.change,
    openPayment: open ? { id: open.id, amount: formatPence(open.amountPence) } : null,
    paid: ps.length > 0 && !open,
  };
}

// ---------------------------------------------------------------------------
// One of the team's jobs, with what's been asked for it.

export type JobPayment = {
  id: string;
  number: string;
  kind: PaymentRequest["kind"];
  description: string;
  /** What's left to pay (all of it, unless some's been paid). */
  amount: string;
  amountPence: number;
  /** The invoice's total, and what's been paid towards it (cash first, say), when some has. */
  total: string;
  paidSoFar: string | null;
  status: "open" | "paid";
  paidVia: string | null;
  /** Being paid monthly: taken through its monthly payments, not here. */
  monthly: boolean;
  /** Which job it's for: this one, another visit ("Tuesday 13 October"), or none yet. */
  job: "this" | "none" | string;
};

/** An invoice for the app's Payment sheet: what's left, and which job it's on. */
export function toJobPayment(p: PaymentRequest, paidPence: number, job: JobPayment["job"]): JobPayment {
  const left = Math.max(0, p.amountPence - paidPence);
  return {
    id: p.id,
    number: invoiceNumber(p.number),
    kind: p.kind,
    description: p.description,
    amount: formatPence(p.status === "open" ? left : p.amountPence),
    amountPence: p.status === "open" ? left : p.amountPence,
    total: formatPence(p.amountPence),
    paidSoFar: paidPence > 0 && p.status === "open" ? formatPence(paidPence) : null,
    status: p.status === "paid" ? "paid" : "open",
    paidVia: p.paidVia ? PAID_VIA_LABEL[p.paidVia] : null,
    monthly: !!p.planStatus,
    job,
  };
}
export type StaffJobDetail = {
  job: StaffJob;
  day: string;
  dayLabel: string;
  /** Their customer page in the app. */
  customerId: string | null;
  /** A request: when they asked for. */
  asked: string | null;
  /** That day's gone without it being booked: a new time, not "as they asked". */
  askedPast?: boolean;
  /** They asked to move it: to when, and why. */
  change: { label: string; note: string | null } | null;
  /** Finished as "coming back": what for, and the return visit once booked. */
  comingBack: { note: string | null; returnVisit: { id: string; when: string } | null } | null;
  /** A return visit: the first visit of the job. */
  firstVisit: { id: string; when: string } | null;
  payments: {
    on: boolean;
    terminalLocation: string | null;
    savedCard: { brand: string; last4: string } | null;
    /** Asked for on this job, open first. */
    forJob: JobPayment[];
    /** The customer's other open invoices: ones not on a job, or on another visit. */
    otherOpen: JobPayment[];
  };
};

/**
 * A job opened from the team's Jobs list: the visit, plus everything the
 * Payment button can take for it. Open invoices for the customer that
 * aren't on this job show too, so the payment can go against the right one.
 */
export async function staffJob(id: string): Promise<StaffJobDetail | null> {
  const v = await getAppointment(id);
  if (!v || v.status === "cancelled") return null;
  const c = v.customerId ? await getCustomer(v.customerId) : null;
  const [onJob, theirs, card] = await Promise.all([
    paymentsForAppointments([v.id]).then((m) => m.get(v.id) ?? []),
    c ? paymentsForCustomer(c.id) : Promise.resolve([]),
    c && paymentsOn() ? savedCardFor(c) : Promise.resolve(null),
  ]);
  const other = theirs.filter((p) => p.status === "open" && p.appointmentId !== v.id);
  const visits = new Map<string, string>();
  await Promise.all(
    [...new Set(other.map((p) => p.appointmentId).filter((x): x is string => !!x))].map(async (aid) => {
      const a = await getAppointment(aid).catch(() => null);
      visits.set(aid, a ? longDate(a.day) : "another visit");
    }),
  );
  const parts = await partPaymentsFor([...onJob, ...other].filter((p) => p.status === "open").map((p) => p.id));
  const [returnVisit, firstVisit] = await Promise.all([
    v.outcome === "return" ? returnVisitFor(v.id) : Promise.resolve(null),
    v.followUpOf ? getAppointment(v.followUpOf) : Promise.resolve(null),
  ]);
  // A return visit: the call-out fee from the first visit shows here too (it comes off this bill).
  const firstFees = firstVisit ? ((await paymentsForAppointments([firstVisit.id])).get(firstVisit.id) ?? []).filter((p) => p.kind === "callout_fee" && p.status !== "cancelled") : [];
  if (firstVisit && firstFees.length) visits.set(firstVisit.id, `the first visit, ${longDate(firstVisit.day)}`);
  const shape = (p: PaymentRequest): JobPayment =>
    toJobPayment(
      p,
      (parts.get(p.id) ?? []).reduce((sum, x) => sum + x.amountPence, 0),
      p.appointmentId === v.id ? "this" : p.appointmentId ? (visits.get(p.appointmentId) ?? "another visit") : "none",
    );

  const today = londonNow().dateISO;
  return {
    job: toStaffJob(v, c ?? undefined, onJob),
    day: v.day,
    customerId: c?.id ?? null,
    asked: v.status === "requested" ? requestedWhen(v.day, v.part) : null,
    askedPast: v.status === "requested" && v.day < today,
    change: v.change ? { label: requestedWhen(v.change.day, v.change.part), note: v.change.note } : null,
    comingBack: v.status === "done" && v.outcome === "return" ? { note: v.returnNote, returnVisit: returnVisit ? { id: returnVisit.id, when: whenLine(returnVisit) } : null } : null,
    firstVisit: firstVisit ? { id: firstVisit.id, when: `${KIND_LABEL[firstVisit.kind]} · ${longDate(firstVisit.day)}` } : null,
    dayLabel: v.day === today ? "Today" : v.day === addDays(today, 1) ? "Tomorrow" : longDate(v.day),
    payments: {
      on: paymentsOn(),
      terminalLocation: process.env.STRIPE_TERMINAL_LOCATION || null,
      savedCard: card ? { brand: card.brand, last4: card.last4 } : null,
      forJob: [...onJob, ...firstFees.filter((p) => !onJob.some((x) => x.id === p.id))]
        .filter((p) => p.status !== "cancelled")
        .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1))
        .map(shape),
      otherOpen: other.map(shape),
    },
  };
}
