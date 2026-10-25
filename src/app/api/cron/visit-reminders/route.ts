import { NextResponse } from "next/server";
import { enquiriesOn } from "@/lib/enquiries";
import { remindersDue } from "@/lib/appointments";
import { sendVisitNotice } from "@/lib/visit-notify";
import { addDays } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";

/**
 * The evening before: every customer with a visit booked tomorrow gets a
 * reminder ("if you can't make it, let us know", with their visit link), by
 * message, email, text and the app. Run once a day by Vercel Cron
 * (vercel.json), which signs its call with CRON_SECRET. Each visit is
 * reminded once (reminded_at), so a re-run never sends twice.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!enquiriesOn()) return NextResponse.json({ skipped: "Supabase is not configured" });

  const tomorrow = addDays(londonNow().dateISO, 1);
  const due = await remindersDue(tomorrow);
  let sent = 0;
  for (const visit of due) {
    const via = await sendVisitNotice(visit.id, "reminder", null);
    if (via.length) sent++;
  }
  return NextResponse.json({ day: tomorrow, due: due.length, sent });
}
