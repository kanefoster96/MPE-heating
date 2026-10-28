import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { sendOnMyWay, toldLine } from "@/lib/visit-notify";

/**
 * "On my way" from the app (lib/visit-notify.ts, the same as the schedule's
 * button): `sent` is how it reached them. Someone with no email or app:
 * `whatsapp` is the message to send from WhatsApp Business.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, eta } = await readJson<{ id: string; eta: number }>(request);
  if (typeof id !== "string") return mobileJson({ error: "Which visit?" }, 400);
  const told = await sendOnMyWay(id, caller.user.id, Number(eta));
  if (!told.via.length) return mobileJson({ error: toldLine(told) }, 400);
  return mobileJson({ ok: true, sent: told.via, message: toldLine(told), whatsapp: told.whatsapp });
}
