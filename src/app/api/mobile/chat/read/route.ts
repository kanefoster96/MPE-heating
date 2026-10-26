import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";
import { getConversationForUser } from "@/lib/chat-db";
import { isTeamConversation, markTeamRead } from "@/lib/team-chat";

/**
 * "I've seen it": clears the unread count. A customer marks their own
 * chat (and, as on the website, re-arms the reply notification); the team
 * mark the conversation they're looking at.
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { conversationId } = await readJson<{ conversationId: string }>(request);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (caller.staff && typeof conversationId === "string") {
    if (await isTeamConversation(conversationId)) await markTeamRead(caller.user.id);
    else await admin.from("chat_conversations").update({ coach_last_read_at: now }).eq("id", conversationId);
    return mobileJson({ ok: true });
  }

  const conversation = await getConversationForUser(caller.user.id);
  if (conversation) {
    await admin.from("chat_conversations").update({ member_last_read_at: now, member_last_active_at: now, member_notified_at: null }).eq("id", conversation.id);
  }
  return mobileJson({ ok: true });
}
