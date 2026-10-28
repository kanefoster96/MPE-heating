import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { sendRunningLate, toldLine } from "@/lib/visit-notify";

/**
 * "Running late" from the app: the arrival window moves on by `minutes`, and
 * the customer's told (lib/visit-notify.ts). Someone with no email or app:
 * `whatsapp` is the message to send from WhatsApp Business.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, minutes } = await readJson<{ id: string; minutes: number }>(request);
  if (typeof id !== "string") return mobileJson({ error: "Which visit?" }, 400);
  const result = await sendRunningLate(id, caller.user.id, Number(minutes));
  if (!result) return mobileJson({ error: "Couldn't move that visit." }, 400);
  return mobileJson({ ok: true, window: result.window, message: `Now ${result.window}. ${toldLine(result)}`, whatsapp: result.whatsapp });
}
