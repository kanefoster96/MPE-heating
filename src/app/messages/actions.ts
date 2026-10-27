"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getAttachmentSignedUrl, getMessagesSince } from "@/lib/chat-db";
import { sendCustomerMessage } from "@/lib/customer-send";
import { ensureWelcome, saveCustomerDetails, type SaveDetailsResult } from "@/lib/chat-welcome";
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
  // The website chat (lib/customer-send.ts, shared with the app).
  const result = await sendCustomerMessage(user, input, "web");
  return result.success ? { success: true } : result;
}

/** The details form under "what's your email address?" in the chat. */
export async function saveChatDetails(input: { name?: string; postcode?: string; email?: string; mobile?: string }): Promise<SaveDetailsResult> {
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
