"use server";

import { redirect } from "next/navigation";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getAttachmentSignedUrl, getMessagesSince, isGuestUser } from "@/lib/chat-db";
import { afterCustomerMessage, ensureWelcome, saveCustomerDetails, type SaveDetailsResult } from "@/lib/chat-welcome";
import { resolveDisplayName } from "@/lib/display-name";
import { captureGuestEmailFromMessage } from "@/lib/chat-email-prompt";
import type { ChatMessage, SendMessageInput } from "@/lib/chat";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/messages");
  return user;
}

/** Kanvas Academy links a chat to its analytics visitor id; MPE has no analytics cookie, so there's none. */
async function currentVisitorId(): Promise<string | undefined> {
  await cookies();
  return undefined;
}

export async function sendMemberMessage(
  input: SendMessageInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireUser();

  const trimmed = input.body.trim();
  if (!trimmed && !input.attachmentPath) {
    return { success: false, error: "Message can't be empty." };
  }

  const conversation = await getOrCreateConversation(user.id, undefined, await currentVisitorId());
  if (!conversation) {
    return {
      success: false,
      error: "Chat is temporarily unavailable — please try again shortly.",
    };
  }

  // Attachments are uploaded into the conversation's own folder; anything
  // else would let a message point at (and get a signed link to) someone
  // else's file.
  if (
    input.attachmentPath &&
    (!input.attachmentPath.startsWith(`${conversation.id}/`) || input.attachmentPath.includes(".."))
  ) {
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
    console.error("sendMemberMessage: insert failed", error);
    return { success: false, error: "Could not send your message." };
  }

  // Clearing completed_at/completed_by means a customer replying after a
  // coach marked this "done" reopens it automatically — nobody has to
  // notice and do that by hand. Writing from here also means they're a web
  // contact (so a later coach reply can reach them by email — see
  // lib/chat-notify.ts), clearly in the chat right now, and any earlier
  // notification is spent.
  const now = new Date().toISOString();
  await admin
    .from("chat_conversations")
    .update({
      last_message_at: now,
      completed_at: null,
      completed_by: null,
      member_last_source: "web",
      member_last_active_at: now,
      member_notified_at: null,
    })
    .eq("id", conversation.id);

  // A visitor answering our "leave us your email" prompt — keep it so a
  // coach can reply once they're free.
  if (isGuestUser(user)) await captureGuestEmailFromMessage(admin, conversation.id, trimmed);

  await notifyStaffOfFamilyMessage({
    conversationId: conversation.id,
    fromName: isGuestUser(user) ? conversation.guestName || "Website visitor" : resolveDisplayName(user),
    body: trimmed,
  });

  // MPE's flow: ask for an email (and mobile) after their first message,
  // or suggest the app once we can reach them (lib/chat-welcome.ts).
  await afterCustomerMessage(conversation.id, isGuestUser(user) ? null : (user.email ?? null));

  return { success: true };
}

/** The details form under "what's your email address?" in the chat. */
export async function saveChatDetails(input: { email?: string; mobile?: string }): Promise<SaveDetailsResult> {
  const user = await requireUser();
  const conversation = await getOrCreateConversation(user.id);
  if (!conversation) return { success: false, error: "Chat is temporarily unavailable — please try again shortly." };
  return saveCustomerDetails(conversation.id, user.id, input);
}

/**
 * "I'm in the chat right now" — ChatThread calls this every ~30s while the
 * thread is on screen, so an engineer reply to someone who's actively watching
 * isn't also emailed to them (see notifyMemberOfReply).
 */
export async function heartbeatMemberActivity(): Promise<void> {
  const user = await requireUser();
  const conversation = await getOrCreateConversation(user.id);
  if (!conversation) return;

  const admin = createAdminClient();
  await admin
    .from("chat_conversations")
    .update({ member_last_active_at: new Date().toISOString() })
    .eq("id", conversation.id);
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  await requireUser();
  return getAttachmentSignedUrl(path);
}

/** Polling fallback ChatThread uses alongside Realtime — see chat-db.ts. */
export async function getNewMessages(
  conversationId: string,
  afterIso: string,
): Promise<ChatMessage[]> {
  await requireUser();
  return getMessagesSince(conversationId, afterIso);
}

export async function markConversationReadAsMember(): Promise<void> {
  const user = await requireUser();
  const conversation = await getOrCreateConversation(user.id);
  if (!conversation) return;

  // Reading also re-arms the reply notification: the next coach reply they
  // aren't around for gets emailed again.
  const now = new Date().toISOString();
  const admin = createAdminClient();
  await admin
    .from("chat_conversations")
    .update({ member_last_read_at: now, member_last_active_at: now, member_notified_at: null })
    .eq("id", conversation.id);
}

/**
 * Silently gives a visitor with no account a real (if nameless) Supabase
 * session — a device-level "visitor ID" that persists via cookies, same
 * idea as Wix's per-device visitor tracking, just backed by a real
 * auth.uid() instead of a bespoke identifier. No form, no message
 * required: called automatically the moment someone with no session opens
 * /messages, so they land straight in an empty, ready-to-type chat.
 * Everything downstream (sending, reading, the coach inbox) reuses the
 * normal member chat path unchanged.
 */
export async function startAnonymousSession(): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();
  const { data, error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError || !data.user) {
    console.error(
      "startAnonymousSession: signInAnonymously failed — is Anonymous Sign-ins enabled in Supabase Auth settings?",
      signInError,
    );
    return {
      success: false,
      error: "Could not start a chat session — please try again.",
    };
  }

  const conversation = await getOrCreateConversation(
    data.user.id,
    undefined,
    await currentVisitorId(),
  );
  if (!conversation) {
    return {
      success: false,
      error: "Chat is temporarily unavailable — please try again shortly.",
    };
  }
  await ensureWelcome(conversation.id);

  return { success: true };
}
