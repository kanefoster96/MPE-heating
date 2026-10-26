import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { isTeamConversation } from "@/lib/team-chat";

/** The team marking a conversation done (it moves out of the inbox) or reopening it, as on /staff/messages. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { conversationId, action } = await readJson<{ conversationId: string; action: string }>(request);
  if (typeof conversationId !== "string" || (action !== "complete" && action !== "reopen")) return mobileJson({ error: "Nothing to change." }, 400);
  if (await isTeamConversation(conversationId)) return mobileJson({ error: "The team chat stays open." }, 400);
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("chat_conversations")
    .update(action === "complete" ? { completed_at: now, completed_by: caller.user.id, coach_last_read_at: now } : { completed_at: null, completed_by: null })
    .eq("id", conversationId);
  if (error) return mobileJson({ error: "Couldn't change that." }, 500);
  return mobileJson({ ok: true });
}
