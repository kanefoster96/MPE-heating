/**
 * The schedule's rules, as pure functions: the kinds of visit, the rough
 * time window each one usually takes, the working day, and how full a day
 * is. No DB or server imports, so pages and client components (the add-visit
 * form) share the same numbers. Minutes are minutes after midnight, London
 * time, as in lib/schedule-time.ts (Kanvas Academy's class times).
 */

export const APPOINTMENT_KINDS = ["callout", "repair", "service", "install", "quote", "other"] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export const KIND_LABEL: Record<AppointmentKind, string> = {
  callout: "Call-out",
  repair: "Repair visit",
  service: "Service",
  install: "Boiler install",
  quote: "Quote visit",
  other: "Other",
};

/**
 * How long each kind of visit is usually booked for, in minutes. Only a
 * starting point for the add-visit form: every visit's window can be changed.
 */
export const KIND_DEFAULT_MINUTES: Record<AppointmentKind, number> = {
  callout: 120,
  repair: 120,
  service: 60,
  install: 9 * 60,
  quote: 60,
  other: 60,
};

/** Tailwind classes for each kind's block on the day view and dot on the month view. */
export const KIND_STYLE: Record<AppointmentKind, { block: string; dot: string }> = {
  callout: { block: "border-accent/50 bg-accent/10", dot: "bg-accent" },
  repair: { block: "border-[#b45309]/50 bg-[#b45309]/10", dot: "bg-[#b45309]" },
  service: { block: "border-success/50 bg-success/10", dot: "bg-success" },
  install: { block: "border-[#1d4ed8]/50 bg-[#1d4ed8]/10", dot: "bg-[#1d4ed8]" },
  quote: { block: "border-[#7c3aed]/50 bg-[#7c3aed]/10", dot: "bg-[#7c3aed]" },
  other: { block: "border-foreground/30 bg-foreground/5", dot: "bg-foreground/50" },
};

/** The statuses the team sets with the buttons on a visit. */
export const APPOINTMENT_STATUSES = ["booked", "done", "cancelled"] as const;
/** Plus 'requested': a customer asked for it, and the team hasn't accepted it yet. */
export type AppointmentStatus = "requested" | (typeof APPOINTMENT_STATUSES)[number];
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Requested",
  booked: "Booked",
  done: "Done",
  cancelled: "Cancelled",
};

/** Morning, afternoon or any time: what a customer asks for, and its window. */
export const PARTS = ["am", "pm", "any"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABEL: Record<Part, string> = { am: "Morning", pm: "Afternoon", any: "Any time" };
export const PART_WINDOW: Record<Part, { start: number; end: number }> = {
  am: { start: 8 * 60, end: 12 * 60 },
  pm: { start: 12 * 60, end: 17 * 60 },
  any: { start: 8 * 60, end: 17 * 60 },
};
export function isPart(value: unknown): value is Part {
  return typeof value === "string" && (PARTS as readonly string[]).includes(value);
}

/** The kinds a customer can ask for themselves. */
export const REQUESTABLE_KINDS = ["service", "callout", "repair"] as const;

/** The working day the schedule measures gaps and full days against: 8am–5pm. */
export const WORKDAY = { start: 8 * 60, end: 17 * 60 };
/** The hours the day view draws: 7am–7pm, so early and late visits still fit. */
export const DAY_VIEW = { start: 7 * 60, end: 19 * 60 };
/** A gap shorter than this isn't worth showing as free. */
export const MIN_GAP_MINUTES = 30;

/** The quick picks on the add-visit form. */
export const WINDOW_PRESETS = [
  { label: "Morning", start: 8 * 60, end: 12 * 60 },
  { label: "Afternoon", start: 12 * 60, end: 17 * 60 },
  { label: "All day", start: WORKDAY.start, end: WORKDAY.end },
] as const;

/** 480 → "8am", 510 → "8:30am", 720 → "12pm". */
export function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${m.toString().padStart(2, "0")}` : ""}${h24 >= 12 ? "pm" : "am"}`;
}

/** (480, 720) → "8am–12pm". */
export function windowLabel(start: number, end: number): string {
  return `${clock(start)}–${clock(end)}`;
}

/** "08:30" → 510; null if it isn't a time. */
export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

/** 510 → "08:30", for <input type="time">. */
export function toHHMM(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

type Window = { start: number; end: number };

/** The windows merged where they overlap, in order. */
function merged(windows: Window[]): Window[] {
  const sorted = [...windows].filter((w) => w.end > w.start).sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

export type DayLoad = {
  /** Minutes of the working day with something booked (overlaps counted once). */
  bookedMinutes: number;
  /** Free stretches in the working day, at least MIN_GAP_MINUTES long. */
  gaps: Window[];
  /** Under an hour of the working day left. */
  full: boolean;
  /** 0–1, how much of the working day is booked. */
  share: number;
};

/** How full a day is, from its (not cancelled) visits' windows. */
export function dayLoad(windows: Window[]): DayLoad {
  const inDay = merged(
    windows.map((w) => ({ start: Math.max(w.start, WORKDAY.start), end: Math.min(w.end, WORKDAY.end) })),
  );
  const bookedMinutes = inDay.reduce((sum, w) => sum + (w.end - w.start), 0);
  const gaps: Window[] = [];
  let cursor = WORKDAY.start;
  for (const w of inDay) {
    if (w.start - cursor >= MIN_GAP_MINUTES) gaps.push({ start: cursor, end: w.start });
    cursor = Math.max(cursor, w.end);
  }
  if (WORKDAY.end - cursor >= MIN_GAP_MINUTES) gaps.push({ start: cursor, end: WORKDAY.end });
  const total = WORKDAY.end - WORKDAY.start;
  return { bookedMinutes, gaps, full: total - bookedMinutes < 60, share: Math.min(1, bookedMinutes / total) };
}

/** "3h 30m" / "45m" / "8h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Overlapping visits side by side on the day view: each gets a column and the
 * number of columns in its cluster, so two jobs at the same time both show.
 */
export function layoutColumns<T extends Window>(items: T[]): { item: T; column: number; columns: number }[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { item: T; column: number; columns: number }[] = [];
  let cluster: { item: T; column: number; columns: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...cluster.map((c) => c.column + 1));
    for (const c of cluster) c.columns = columns;
    out.push(...cluster);
    cluster = [];
  };
  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.item.end > item.start).map((c) => c.column));
    let column = 0;
    while (taken.has(column)) column++;
    cluster.push({ item, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();
  return out;
}

// ---------------------------------------------------------------------------
// Dates. ISO dates (YYYY-MM-DD) handled in UTC so server and browser agree.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function isISODate(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Monday 27 October". */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 27 Oct". */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "2026-10" → "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function isMonth(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The month grid: whole weeks, Monday first, covering the month. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const firstDow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -firstDow);
  const weeks: string[][] = [];
  let day = start;
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (day.slice(0, 7) === month);
  return weeks;
}
