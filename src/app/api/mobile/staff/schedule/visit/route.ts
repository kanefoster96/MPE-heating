import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { KINDS, saveVisit, visitDraft, type VisitBody } from "@/lib/app-schedule";

/** The app's add or change visit form: the visit (`?id=`), or a new one (`?customer=`, `?day=`, or the return visit for `?followUp=`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const q = new URL(request.url).searchParams;
  const draft = await visitDraft({ id: q.get("id"), customerId: q.get("customer"), day: q.get("day"), followUp: q.get("followUp"), conversationId: q.get("conversation") });
  return draft ? mobileJson({ draft, kinds: KINDS }) : mobileJson({ error: "That visit's gone." }, 404);
}

/** Adds a visit, or saves one (`id`), as the website's schedule does, telling the customer if `notify`. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson<VisitBody & { id: string | null }>(request);
  const result = await saveVisit(typeof body.id === "string" ? body.id : null, body, caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
