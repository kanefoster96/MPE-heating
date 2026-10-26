import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffDay } from "@/lib/app-jobs";

/** The team's Jobs tab: one day's visits (`?day=YYYY-MM-DD`, today by default) and the fortnight's strip (lib/app-jobs.ts). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await staffDay(new URL(request.url).searchParams.get("day")));
}
