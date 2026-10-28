import { londonNow } from "@/lib/schedule-time";
import { getSetting } from "@/lib/settings";

/**
 * MPE's opening hours, every day (London time), set in Settings: calls to
 * the MPE number ring the team and customers' messages notify them.
 * Outside them, calls go to voicemail (with the text back), the chat says
 * when we're open, and messages wait for one summary when we open
 * (lib/follow-up-sweep.ts), so nobody's phone goes off out of hours.
 */
export type TeamHours = { from: number; until: number };

/** 8am to 8pm until Settings say otherwise. */
export const DEFAULT_HOURS: TeamHours = { from: 8 * 60, until: 20 * 60 };

let cached: { at: number; hours: TeamHours } | null = null;

/** Minutes after midnight, from Settings; the default if they're missing or don't make sense. */
export function parseHours(from: string | null, until: string | null): TeamHours {
  const f = Number(from);
  const u = Number(until);
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 24 * 60;
  return from !== null && until !== null && ok(f) && ok(u) && f < u ? { from: f, until: u } : DEFAULT_HOURS;
}

export async function teamHours(): Promise<TeamHours> {
  // Read at most once a minute: every call, message and sweep asks.
  if (cached && Date.now() - cached.at < 60_000) return cached.hours;
  const [from, until] = await Promise.all([getSetting("hours_from"), getSetting("hours_until")]).catch(() => [null, null] as const);
  const hours = parseHours(from, until);
  cached = { at: Date.now(), hours };
  return hours;
}

/** After Settings change them, so this server uses the new hours straight away. */
export function forgetTeamHours(): void {
  cached = null;
}

/** Whether we're open now. */
export async function teamHoursOpen(): Promise<boolean> {
  const { from, until } = await teamHours();
  const { minutes } = londonNow();
  return minutes >= from && minutes < until;
}

/** "8am", "8:30am", "12pm" (midnight is "12am"). */
export function clockWord(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h24 < 12 ? "am" : "pm"}`;
}

/** "8am to 8pm". */
export function hoursLabel(h: TeamHours): string {
  return `${clockWord(h.from)} to ${clockWord(h.until === 24 * 60 ? 0 : h.until)}`;
}
