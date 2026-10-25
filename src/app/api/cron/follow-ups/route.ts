import { NextResponse } from "next/server";
import { enquiriesOn } from "@/lib/enquiries";
import { runFollowUpSweep } from "@/lib/follow-up-sweep";

/**
 * Every automatic reminder and follow-up (lib/follow-up-sweep.ts). Run every
 * five minutes by Vercel Cron (vercel.json), which signs its call with
 * CRON_SECRET. Safe to run as often as you like: nothing sends twice.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!enquiriesOn()) return NextResponse.json({ skipped: "Supabase is not configured" });
  return NextResponse.json(await runFollowUpSweep());
}
