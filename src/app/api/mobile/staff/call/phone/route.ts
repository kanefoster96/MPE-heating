import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { saveCoachPhone } from "@/lib/coach-calls";
import { formatPhone } from "@/lib/phone";

/** Their own mobile: the phone that rings first when they call as MPE (else MPE's main number). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { phone } = await readJson<{ phone: string }>(request);
  const saved = typeof phone === "string" ? await saveCoachPhone(caller.user.id, phone) : null;
  return saved ? mobileJson({ phone: formatPhone(saved) }) : mobileJson({ error: "Please enter a UK mobile number, like 07123 456789." }, 400);
}
