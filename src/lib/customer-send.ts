import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { getOrCreateConversation, isGuestUser } from "@/lib/chat-db";
import { afterCustomerMessage } from "@/lib/chat-welcome";
import { resolveDisplayName } from "@/lib/display-name";
import { captureGuestEmailFromMessage } from "@/lib/chat-email-prompt";
import type { ChatSource, SendMessageInput } from "@/lib/chat";

export type CustomerSendResult = { success: true; conversationId: string } | { success: false; error: string };

/**
 * A customer's message into their own conversation: the one implementation
 * behind the website's chat (app/messages/actions.ts) and the app's
 * /api/mobile/chat/send. `source` is where they wrote from: a "web"
 * contact is emailed a reply they miss, an "app" one gets a push.
 */
export async function sendCustomerMessage(user: User, input: SendMessageInput, source: ChatSource): Promise<CustomerSendResult> {
  const trimmed = input.body.trim();
  if (!trimmed && !input.attachmentPath) return { success: false, error: "Message can't be empty." };

  const conversation = await getOrCreateConversation(user.id);
  if (!conversation) return { success: false, error: "Chat is temporarily unavailable — please try again shortly." };

  // Attachments are uploaded into the conversation's own folder; anything
  // else would let a message point at (and get a signed link to) someone
  // else's file.
  if (input.attachmentPath && (!input.attachmentPath.startsWith(`${conversation.id}/`) || input.attachmentPath.includes(".."))) {
    return { success: false, error: "Could not attach that file." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("chat_messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    sender_is_coach: false,
    body: trimmed,
    attachment_path: input.attachmentPath ?? null,
    attachment_type: input.attachmentType ?? null,
    attachment_name: input.attachmentName ?? null,
  });
  if (error) {
    console.error("sendCustomerMessage: insert failed", error);
    return { success: false, error: "Could not send your message." };
  }

  // Clearing completed_at/completed_by means a customer replying after the
  // team marked this "done" reopens it automatically. Writing from here
  // also records where they wrote from (lib/chat-notify.ts reads it), that
  // they're in the chat right now, and that any earlier notification is
  // spent.
  const now = new Date().toISOString();
  await admin
    .from("chat_conversations")
    .update({ last_message_at: now, completed_at: null, completed_by: null, member_last_source: source, member_last_active_at: now, member_notified_at: null })
    .eq("id", conversation.id);

  // A visitor answering our "leave us your email" prompt — keep it so the
  // team can reply once they're free.
  if (isGuestUser(user)) await captureGuestEmailFromMessage(admin, conversation.id, trimmed);

  await notifyStaffOfFamilyMessage({
    conversationId: conversation.id,
    fromName: isGuestUser(user) ? conversation.guestName || (source === "app" ? "App visitor" : "Website visitor") : resolveDisplayName(user),
    body: trimmed,
  });

  // MPE's flow on the website: ask for an email (and mobile) after their
  // first message, or suggest the app once we can reach them
  // (lib/chat-welcome.ts). Nothing in the app.
  await afterCustomerMessage(conversation.id, isGuestUser(user) ? null : (user.email ?? null), source);

  return { success: true, conversationId: conversation.id };
}
