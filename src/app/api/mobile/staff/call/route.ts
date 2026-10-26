import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { usagePaused } from "@/lib/twilio-usage";
import { businessCallsOn, callSetup, callableUkNumber, CoachPhoneMissingError, startBridgedCall } from "@/lib/coach-calls";

/** The app's Call sheet: whether calls go from the MPE number yet, that number, and the phone that rings first. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await callSetup(caller.user));
}

/**
 * "Call as MPE" (lib/coach-calls.ts): their phone rings first, then
 * they're put through, and the customer sees the MPE number. A chat
 * (`conversationId`: its number, and the call's noted there) or a number
 * (`to`, from a customer or a job).
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!businessCallsOn()) return mobileJson({ error: "Calls from the MPE number are off. Call on WhatsApp or your own phone." }, 403);
  if (await usagePaused()) return mobileJson({ error: "Calls and texts are paused until the 1st (Settings → Calls and texts). Call on WhatsApp or your own phone." }, 403);
  const body = await readJson<{ conversationId: string; to: string }>(request);
  let to: string | null = null;
  let conversationId: string | null = null;
  if (typeof body.conversationId === "string") {
    const { data } = await createAdminClient().from("chat_conversations").select("id, phone, is_team").eq("id", body.conversationId).maybeSingle();
    if (!data || data.is_team) return mobileJson({ error: "That conversation has gone." }, 404);
    to = callableUkNumber(data.phone as string | null);
    conversationId = data.id as string;
  } else {
    to = callableUkNumber(typeof body.to === "string" ? body.to : null);
  }
  if (!to) return mobileJson({ error: "That isn't a UK number we can call." }, 400);
  // Called from their customer page or the job: still logged in their chat, if they have one.
  if (!conversationId) {
    const { data } = await createAdminClient().from("chat_conversations").select("id").eq("phone", to).maybeSingle();
    conversationId = (data?.id as string | undefined) ?? null;
  }
  try {
    await startBridgedCall({ coach: caller.user, to, conversationId });
    return mobileJson({ ok: true });
  } catch (err) {
    if (err instanceof CoachPhoneMissingError) return mobileJson({ error: err.message, needsPhone: true }, 409);
    console.error("api/mobile/staff/call failed", err);
    return mobileJson({ error: "Couldn't start the call. Please try again." }, 500);
  }
}
