import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { getConversationForCoachById, getMessagesForApp, getOrCreateConversation, isGuestUser } from "@/lib/chat-db";
import { ensureWelcome } from "@/lib/chat-welcome";
import { resolveDisplayName } from "@/lib/display-name";
import { TEAM_CHAT_NAME } from "@/lib/team-chat";

/**
 * A chat for the app. A customer gets their own (made on first open, with
 * the welcome message, like the website's /messages). The team pass
 * `conversationId` for any customer's. `after` (an ISO time) returns only
 * newer messages: the app polls with it alongside Realtime.
 */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const params = new URL(request.url).searchParams;
  const after = params.get("after");
  const requested = params.get("conversationId");

  if (caller.staff && requested) {
    const conversation = await getConversationForCoachById(requested);
    if (!conversation) return mobileJson({ error: "That conversation has gone." }, 404);
    let title = TEAM_CHAT_NAME;
    if (!conversation.isTeam) {
      const { data } = await createAdminClient().auth.admin.getUserById(conversation.userId);
      title = isGuestUser(data?.user) ? conversation.guestName || "Guest" : resolveDisplayName(data?.user, "Customer");
    }
    return mobileJson({
      conversation: { id: conversation.id, title, phone: conversation.phone, completed: !!conversation.completedAt, isTeam: !!conversation.isTeam },
      messages: await getMessagesForApp(conversation.id, after),
      viewer: { id: caller.user.id, staff: true },
    });
  }

  const conversation = await getOrCreateConversation(caller.user.id);
  if (!conversation) return mobileJson({ error: "Chat is temporarily unavailable. Please try again shortly." }, 503);
  if (!after) await ensureWelcome(conversation.id);
  return mobileJson({
    conversation: { id: conversation.id, title: "The MPE team", phone: null, completed: false, isTeam: false },
    messages: await getMessagesForApp(conversation.id, after),
    viewer: { id: caller.user.id, staff: caller.staff },
  });
}
