import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { finish, finishDraft, type FinishBody } from "@/lib/app-finish";

/** Finish job in the app: what's saved so far, to edit (lib/app-finish.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const draft = await finishDraft(id);
  return draft ? mobileJson(draft) : mobileJson({ error: "That job's gone." }, 404);
}

/** Marks the job done (or saves it again), as the website's Finish job does. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const result = await finish(id, await readJson<FinishBody>(request), caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
