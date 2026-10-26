import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { ENQUIRY_STATUSES, setEnquiryStatus, type EnquiryStatus } from "@/lib/enquiries";

/** Moves a booking enquiry along: new, contacted, booked, done (or closed), as on the website's inbox. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, status } = await readJson<{ id: string; status: string }>(request);
  if (typeof id !== "string" || !(ENQUIRY_STATUSES as readonly string[]).includes(String(status))) return mobileJson({ error: "Nothing to change." }, 400);
  return (await setEnquiryStatus(id, status as EnquiryStatus, caller.user.id)) ? mobileJson({ ok: true }) : mobileJson({ error: "Couldn't save that." }, 500);
}
