import { NextResponse } from "next/server";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { customerJobs } from "@/lib/app-jobs";

/** The customer's Jobs tab: what's underway with its steps, then previous jobs (lib/app-jobs.ts). */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await customerJobs(caller.user).catch(() => ({ active: [], previous: [] })));
}
