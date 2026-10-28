/**
 * Pure date/time helpers for the class schedule — no DB or server-only
 * imports, so both server code (attendance calc) and client components
 * (live "starting soon"/"live" labels) can share the exact same math.
 * Everything here is computed against Europe/London local time regardless
 * of where the server or the viewer's device actually is, since that's the
 * timezone the studio actually operates in (avoids a BST/GMT off-by-an-hour
 * bug from naive server-UTC comparisons).
 */

export const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const DAY_NAMES = Object.keys(DAY_INDEX);

const LONDON_TZ = "Europe/London";

export type LondonNow = { weekday: string; minutes: number; dateISO: string };

export function londonNow(at: Date = new Date()): LondonNow {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    minutes: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10),
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export type LondonParts = {
  year: number;
  /** 0-based, like Date#getMonth. */
  month: number;
  day: number;
  /** 0 = Sunday, like Date#getDay. */
  weekday: number;
  hours: number;
  minutes: number;
  dateISO: string;
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * A timestamp broken down in London time. Server code that formats a
 * clock time must go through this rather than Date#getHours: Vercel runs
 * in UTC, so the local getters show BST check-ins and messages an hour
 * early.
 */
/** The moment a London wall-clock time happens ("2026-10-24", 20:00), right across a clock change. */
export function londonInstant(dateISO: string, minutes: number): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  // London is UTC or UTC+1: two corrections settle it.
  for (let i = 0; i < 2; i++) {
    const seen = londonNow(new Date(guess));
    const dayShift = seen.dateISO === dateISO ? 0 : seen.dateISO > dateISO ? 1440 : -1440;
    guess -= (dayShift + seen.minutes - minutes) * 60_000;
  }
  return new Date(guess);
}

export function londonParts(at: Date | string): LondonParts {
  const date = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10) - 1,
    day: parseInt(get("day"), 10),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    hours: parseInt(get("hour"), 10),
    minutes: parseInt(get("minute"), 10),
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** "18:14" in London time. */
export function formatLondonClock(at: Date | string): string {
  const { hours, minutes } = londonParts(at);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function to24Hour(hour12: number, period: "am" | "pm"): number {
  if (period === "am") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

/** "18:15" -> 1095 (minutes since midnight). */
export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

/** Minutes since midnight -> "HH:MM" 24-hour, for <input type="time"> defaultValue. */
export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function periodOf(totalMinutes: number): "am" | "pm" {
  return Math.floor(totalMinutes / 60) % 24 >= 12 ? "pm" : "am";
}

/** Minutes since midnight -> "6:15pm". */
export function formatClock(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = periodOf(totalMinutes);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")}${period}`;
}

/** (1095, 1155) -> "6:15–7:15pm" — drops the leading am/pm when both ends share it. */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  const startStr = formatClock(startMinutes);
  const endStr = formatClock(endMinutes);
  if (periodOf(startMinutes) === periodOf(endMinutes)) {
    return `${startStr.replace(/(am|pm)$/, "")}–${endStr}`;
  }
  return `${startStr}–${endStr}`;
}

/** Parses "6:15–7:15pm" / "11:45am–12:15pm" style ranges (lib/classes.ts's format) into minutes. */
export function parseDisplayTimeRange(
  display: string,
): { startMinutes: number; endMinutes: number } | null {
  const match = display.match(
    /^(\d{1,2}):(\d{2})\s*(am|pm)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i,
  );
  if (!match) return null;

  const [, h1, m1, p1, h2, m2, p2] = match;
  const period2 = p2.toLowerCase() as "am" | "pm";
  const period1 = (p1 ? p1.toLowerCase() : period2) as "am" | "pm";

  return {
    startMinutes: to24Hour(parseInt(h1, 10), period1) * 60 + parseInt(m1, 10),
    endMinutes: to24Hour(parseInt(h2, 10), period2) * 60 + parseInt(m2, 10),
  };
}

/** Every calendar date (YYYY-MM-DD) matching `weekday` between `sinceISO` and `untilISO`, inclusive, skipping any in `canceledDateISOs`. */
export function occurrenceDatesBetween(
  weekday: string,
  sinceISO: string,
  untilISO: string,
  canceledDateISOs: Set<string>,
): string[] {
  const targetDow = DAY_INDEX[weekday];
  if (targetDow === undefined || sinceISO > untilISO) return [];

  const dates: string[] = [];
  const cursor = new Date(`${sinceISO}T00:00:00Z`);
  const end = new Date(`${untilISO}T00:00:00Z`);
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() === targetDow) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!canceledDateISOs.has(iso)) dates.push(iso);
    }
  }
  return dates;
}

/** `fromISO` plus `days` (may be negative), as an ISO date. */
export function addDaysISO(fromISO: string, days: number): string {
  const date = new Date(`${fromISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The first date on/after `fromISO` that falls on `weekday` and isn't in `canceledDateISOs` — null if none found within a year (shouldn't happen for a weekly recurring class). */
export function firstAvailableOccurrence(
  weekday: string,
  fromISO: string,
  canceledDateISOs: Set<string>,
): string | null {
  return nextAvailableOccurrences(weekday, fromISO, canceledDateISOs, 1)[0] ?? null;
}

/**
 * Up to `count` dates on/after `fromISO` that fall on `weekday` and aren't in
 * `canceledDateISOs` — the fixed menu a trial date picker offers, rather
 * than a single date to march forward one click at a time.
 */
export function nextAvailableOccurrences(
  weekday: string,
  fromISO: string,
  canceledDateISOs: Set<string>,
  count: number,
): string[] {
  const targetDow = DAY_INDEX[weekday];
  if (targetDow === undefined || count <= 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${fromISO}T00:00:00Z`);
  for (let i = 0; i < 366 && dates.length < count; i++) {
    if (cursor.getUTCDay() === targetDow) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!canceledDateISOs.has(iso)) dates.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "12 Jan" from an ISO date — built manually (not toLocaleDateString) so server and client render the same string regardless of ICU/locale differences. */
export function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}
