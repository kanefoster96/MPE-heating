import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { VISIT_ACTIONS, visitAction, type VisitAction } from "@/lib/app-schedule";

/** A visit's buttons in the app: accept a request, keep the time, send the details, back to booked, cancel, remove. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, action } = await readJson<{ id: string; action: string }>(request);
  if (typeof id !== "string" || !VISIT_ACTIONS.includes(action as VisitAction)) return mobileJson({ error: "Nothing to do." }, 400);
  const result = await visitAction(id, action as VisitAction, caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
