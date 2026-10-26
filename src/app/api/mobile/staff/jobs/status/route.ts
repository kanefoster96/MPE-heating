import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { setAppointmentStatus } from "@/lib/appointments";

/**
 * "Not in" from the app, or undoing it (back to booked), as on the
 * schedule. The day after a "Not in", the follow-up sweep offers them
 * another time. Finishing a job is the website's finish page, opened
 * signed in.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, status } = await readJson<{ id: string; status: string }>(request);
  if (typeof id !== "string" || (status !== "no_access" && status !== "booked")) return mobileJson({ error: "Nothing to change." }, 400);
  if (!(await setAppointmentStatus(id, status))) return mobileJson({ error: "Couldn't change that." }, 500);
  return mobileJson({ ok: true });
}
