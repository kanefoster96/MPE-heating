import { NextResponse } from "next/server";
import { closedDays } from "@/lib/days-off";
import { addDays } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";

/**
 * The days MPE isn't working in the next two months, for the day pickers
 * customers use to ask for a visit (components/DayPartPicker.tsx). Just
 * the dates, never the notes.
 */
export async function GET() {
  const today = londonNow().dateISO;
  const days = await closedDays(today, addDays(today, 60)).catch(() => new Map<string, string | null>());
  return NextResponse.json({ days: [...days.keys()] }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
