import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffMetrics } from "@/lib/app-menu";

/** The app's Metrics screen: a month in numbers against the one before (`?month=YYYY-MM`). Admins only. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Metrics are for admins." }, 403);
  return mobileJson(await staffMetrics(new URL(request.url).searchParams.get("month")));
}
