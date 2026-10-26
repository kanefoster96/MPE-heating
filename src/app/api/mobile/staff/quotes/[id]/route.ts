import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { QUOTE_ACTIONS, quoteAction, quoteDetail, type QuoteAction } from "@/lib/app-quotes";

/** One quote in the app: what was sent and where it's got to. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const detail = await quoteDetail(id);
  return detail ? mobileJson(detail) : mobileJson({ error: "That quote has gone." }, 404);
}

/** Send it again, withdraw it, or invoice the rest once the work's done. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const { action, jobId, take } = await readJson<{ action: string; jobId?: string; take?: boolean }>(request);
  if (!QUOTE_ACTIONS.includes(action as QuoteAction)) return mobileJson({ error: "Nothing to do." }, 400);
  const result = await quoteAction(id, action as QuoteAction, caller.user.id, { jobId: typeof jobId === "string" ? jobId : null, take: take === true });
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
