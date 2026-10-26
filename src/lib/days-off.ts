import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/day-plan";
import { enquiriesOn } from "@/lib/enquiries";

/**
 * Days off and holidays (Kanvas One's "bookings blocked automatically").
 * Fergal adds a day or a run of days; customers can't pick them when they
 * ask for a visit (booking forms, their account, the pick-a-time and visit
 * pages), the schedule greys them out, and booking a visit on one warns
 * him first. Service-role only.
 */

export type DayOff = { id: string; startsOn: string; endsOn: string; note: string | null };

export async function listDaysOff(fromISO: string): Promise<DayOff[]> {
  if (!enquiriesOn()) return [];
  const { data } = await createAdminClient().from("days_off").select("id, starts_on, ends_on, note").gte("ends_on", fromISO).order("starts_on").limit(200);
  return (data ?? []).map((r) => ({ id: r.id as string, startsOn: r.starts_on as string, endsOn: r.ends_on as string, note: (r.note as string | null) ?? null }));
}

/** Every day off between two dates (inclusive), as "YYYY-MM-DD", with its note. */
export async function closedDays(fromISO: string, toISO: string): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!enquiriesOn()) return map;
  const { data } = await createAdminClient().from("days_off").select("starts_on, ends_on, note").lte("starts_on", toISO).gte("ends_on", fromISO);
  for (const r of data ?? []) {
    for (let d = r.starts_on as string; d <= (r.ends_on as string); d = addDays(d, 1)) {
      if (d >= fromISO && d <= toISO) map.set(d, (r.note as string | null) ?? null);
    }
  }
  return map;
}

export async function isDayOff(day: string): Promise<boolean> {
  return (await closedDays(day, day)).has(day);
}

export async function addDayOff(params: { startsOn: string; endsOn: string; note: string | null; staffId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(params.startsOn) || !iso.test(params.endsOn)) return { ok: false, error: "Pick the first and last day." };
  if (params.endsOn < params.startsOn) return { ok: false, error: "The last day needs to be on or after the first." };
  if (addDays(params.startsOn, 120) < params.endsOn) return { ok: false, error: "That's over four months: add it in shorter runs." };
  const { error } = await createAdminClient()
    .from("days_off")
    .insert({ starts_on: params.startsOn, ends_on: params.endsOn, note: params.note?.trim().slice(0, 120) || null, created_by: params.staffId });
  return error ? { ok: false, error: "Couldn't save that." } : { ok: true };
}

export async function removeDayOff(id: string): Promise<void> {
  await createAdminClient().from("days_off").delete().eq("id", id);
}
