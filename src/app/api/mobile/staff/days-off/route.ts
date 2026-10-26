import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { daysOff, deleteDayOff, saveDayOff } from "@/lib/app-business";

/** Days off coming up, with anything already booked on them. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await daysOff());
}

/** A day off, or a run of them, checked as the website checks them. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const result = await saveDayOff(await readJson<{ startsOn?: string; endsOn?: string; note?: string }>(request), caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}

export async function DELETE(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await readJson<{ id?: string }>(request);
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return mobileJson({ error: "Which day?" }, 400);
  return mobileJson(await deleteDayOff(id));
}
