import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Someone chatting on the website is an anonymous guest until they sign in
 * at /account with their email. Signing in makes a different login, so the
 * guest's conversation is moved over to it, along with their messages, so
 * the chat carries on where it left off. Only an anonymous guest's
 * conversation moves, and only when the new login doesn't have one already.
 */
export const PREVIOUS_GUEST_COOKIE = "mpe_prev_guest";

export async function claimGuestConversation(guestUserId: string, userId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(guestUserId) || guestUserId === userId) return;
  try {
    const admin = createAdminClient();
    const { data: guest } = await admin.auth.admin.getUserById(guestUserId);
    if (!guest?.user?.is_anonymous) return;

    const { data: existing } = await admin.from("chat_conversations").select("id").eq("user_id", userId).maybeSingle();
    if (existing) return;
    const { data: conversation } = await admin.from("chat_conversations").select("id").eq("user_id", guestUserId).maybeSingle();
    if (!conversation) return;

    await admin.from("chat_conversations").update({ user_id: userId }).eq("id", conversation.id);
    await admin.from("chat_messages").update({ sender_id: userId }).eq("conversation_id", conversation.id).eq("sender_id", guestUserId);
    await admin.from("customers").update({ user_id: userId }).eq("conversation_id", conversation.id).is("user_id", null);
  } catch (err) {
    console.error("claimGuestConversation failed", err);
  }
}
