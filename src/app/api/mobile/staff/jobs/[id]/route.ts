import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffJob } from "@/lib/app-jobs";

/** One of the team's jobs, opened from Jobs: the visit and what the Payment button can take for it (lib/app-jobs.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const detail = await staffJob(id);
  return detail ? mobileJson(detail) : mobileJson({ error: "That job's gone: it may have been cancelled." }, 404);
}
