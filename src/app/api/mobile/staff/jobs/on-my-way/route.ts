import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { sendOnMyWay } from "@/lib/visit-notify";

/** "On my way" from the app (lib/visit-notify.ts, the same as the schedule's button): `sent` is how it reached them. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id, eta } = await readJson<{ id: string; eta: number }>(request);
  if (typeof id !== "string") return mobileJson({ error: "Which visit?" }, 400);
  const sent = await sendOnMyWay(id, caller.user.id, Number(eta));
  if (!sent.length) return mobileJson({ error: "Couldn't reach them: add a mobile or email to their customer page." }, 400);
  return mobileJson({ ok: true, sent });
}
