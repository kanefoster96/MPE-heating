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

/**
 * One chat per customer. Booking forms, texts and calls file under their
 * phone number (a phone-only contact, lib/chat-db.ts), while signing in
 * gives them a login of their own. When a signed-in customer's record
 * points at one of those contacts' conversations, it becomes theirs:
 * anything they'd already written under their own login moves into it, so
 * they and the team see the one thread. A conversation that belongs to
 * someone else's real login is never taken.
 */
export async function adoptCustomerConversation(userId: string, email: string | null | undefined): Promise<void> {
  try {
    const admin = createAdminClient();
    const lower = email?.trim().toLowerCase() || null;
    const { data: linked } = await admin.from("customers").select("id, conversation_id, user_id").eq("user_id", userId).maybeSingle();
    const { data: byEmail } =
      linked || !lower ? { data: null } : await admin.from("customers").select("id, conversation_id, user_id").eq("email", lower).is("user_id", null).maybeSingle();
    const customer = (linked ?? byEmail) as { id: string; conversation_id: string | null; user_id: string | null } | null;
    if (!customer) return;
    if (!customer.user_id) await admin.from("customers").update({ user_id: userId }).eq("id", customer.id);

    const { data: own } = await admin.from("chat_conversations").select("id, last_message_at").eq("user_id", userId).maybeSingle();
    if (!customer.conversation_id) {
      if (own) await admin.from("customers").update({ conversation_id: own.id }).eq("id", customer.id);
      return;
    }
    const { data: theirs } = await admin.from("chat_conversations").select("id, user_id, last_message_at").eq("id", customer.conversation_id).maybeSingle();
    if (!theirs || theirs.user_id === userId) return;
    if (theirs.user_id) {
      const { data: owner } = await admin.auth.admin.getUserById(theirs.user_id as string);
      const meta = owner?.user?.user_metadata ?? {};
      if (owner?.user && !owner.user.is_anonymous && !meta.sms_guest && !meta.email_guest) return;
    }

    // Their own login's conversation folds into it: messages, bookings and payments.
    if (own) {
      await admin.from("chat_messages").update({ conversation_id: theirs.id }).eq("conversation_id", own.id);
      for (const table of ["enquiries", "payment_requests", "customers"]) {
        await admin.from(table).update({ conversation_id: theirs.id }).eq("conversation_id", own.id);
      }
      await admin.from("chat_conversations").delete().eq("id", own.id);
    }
    const last = [theirs.last_message_at as string, (own?.last_message_at as string | undefined) ?? ""].sort().pop();
    await admin.from("chat_conversations").update({ user_id: userId, last_message_at: last }).eq("id", theirs.id);
    if (theirs.user_id) {
      await admin.from("chat_messages").update({ sender_id: userId }).eq("conversation_id", theirs.id).eq("sender_id", theirs.user_id).eq("sender_is_coach", false);
    }
  } catch (err) {
    console.error("adoptCustomerConversation failed", err);
  }
}
