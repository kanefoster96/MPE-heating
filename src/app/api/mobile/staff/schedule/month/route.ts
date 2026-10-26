import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { monthSummary } from "@/lib/app-schedule";

/** The app's calendar: a month's visits per day, and the days off (`?month=YYYY-MM`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await monthSummary(new URL(request.url).searchParams.get("month") ?? ""));
}
