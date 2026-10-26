import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { TAKE_ACTIONS, takePayment, type TakeAction } from "@/lib/app-payments";

/** A button on the app's Payment sheet (lib/app-payments.ts): charge the saved card, cash (all or part), bank transfer, the link again, or link it to the job first. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { paymentId, jobId, action, amountPence } = await readJson<{ paymentId: string; jobId: string | null; action: string; amountPence: number }>(request);
  if (typeof paymentId !== "string" || !TAKE_ACTIONS.includes(action as TakeAction)) return mobileJson({ error: "Nothing to do." }, 400);
  const result = await takePayment({
    paymentId,
    jobId: typeof jobId === "string" ? jobId : null,
    action: action as TakeAction,
    amountPence: typeof amountPence === "number" && Number.isFinite(amountPence) ? Math.round(amountPence) : null,
    staffId: caller.user.id,
  });
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, result.status);
}
