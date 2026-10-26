"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCoach } from "@/lib/coach";
import { getAttachmentSignedUrl, getMessagesSince, getOrCreateConversationByPhone } from "@/lib/chat-db";
import { ENQUIRY_STATUSES, setEnquiryStatus, type EnquiryStatus } from "@/lib/enquiries";
import { revalidatePath } from "next/cache";
import { deliverCoachMessage } from "@/lib/coach-send";
import { normalizeUkPhone } from "@/lib/twilio";
import type { ChatMessage, SendMessageInput } from "@/lib/chat";
import { isTeamConversation, markTeamRead, teamReadReceipts, type TeamReadReceipt } from "@/lib/team-chat";
import { setConversationPhone } from "@/lib/app-chat";

async function requireCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/staff/messages");
  if (!(await isCoach(user.id))) redirect("/");

  return user;
}

export async function sendCoachMessage(
  conversationId: string,
  input: SendMessageInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireCoach();
  const { paymentRequestId: _ignored, ...message } = input; // Kanvas Academy payment cards: not used by MPE
  void _ignored;
  const result = await deliverCoachMessage({ user, conversationId, input: message });
  return result.success ? { success: true } : { success: false, error: result.error };
}

/** Adds or corrects the phone number a conversation's "Text" send option uses — anyone on the team can set this, same as sending a message. */
export async function updateConversationPhone(
  conversationId: string,
  phone: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireCoach();

  const result = await setConversationPhone(conversationId, phone);
  return result.ok ? { success: true } : { success: false, error: result.error };
}

export async function markConversationReadAsCoach(
  conversationId: string,
): Promise<void> {
  const user = await requireCoach();
  if (await isTeamConversation(conversationId)) return markTeamRead(user.id);
  const admin = createAdminClient();

  await admin
    .from("chat_conversations")
    .update({ coach_last_read_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Marks a conversation done, moving it into the coach-side History list —
 * anyone on the team can do this. Any new message from either side clears it
 * automatically (see sendCoachMessage/sendMemberMessage), so a completed
 * thread reopens itself the moment it's needed again rather than staying
 * stuck archived.
 */
export async function completeConversation(
  conversationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireCoach();
  if (await isTeamConversation(conversationId)) return { success: false, error: "The team chat stays open." };
  const admin = createAdminClient();

  // Also marks it read — otherwise a conversation completed with an unread
  // message still sitting in it (e.g. closing something out without
  // opening every message) would keep counting toward the global unread
  // badge forever after being archived into History.
  const now = new Date().toISOString();
  const { error } = await admin
    .from("chat_conversations")
    .update({ completed_at: now, completed_by: user.id, coach_last_read_at: now })
    .eq("id", conversationId);

  if (error) {
    return { success: false, error: "Could not mark this conversation complete." };
  }
  return { success: true };
}

/** Moves a conversation back out of History — anyone on the team can do this. */
export async function reopenConversation(
  conversationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireCoach();
  const admin = createAdminClient();

  const { error } = await admin
    .from("chat_conversations")
    .update({ completed_at: null, completed_by: null })
    .eq("id", conversationId);

  if (error) {
    return { success: false, error: "Could not reopen this conversation." };
  }
  return { success: true };
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  await requireCoach();
  return getAttachmentSignedUrl(path);
}

/** Polling fallback ChatThread uses alongside Realtime — see chat-db.ts. */
export async function getNewMessages(
  conversationId: string,
  afterIso: string,
): Promise<ChatMessage[]> {
  await requireCoach();
  return getMessagesSince(conversationId, afterIso);
}

/** The team chat: who has seen the latest post (for the "Seen by" bar). */
export async function getTeamReadReceipts(): Promise<TeamReadReceipt[]> {
  const user = await requireCoach();
  return teamReadReceipts(user.id);
}

/** Moves a booking enquiry along: new → contacted → booked → done (or closed). */
export async function updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
  const user = await requireCoach();
  if (!(ENQUIRY_STATUSES as readonly string[]).includes(status)) return;
  await setEnquiryStatus(id, status, user.id);
  revalidatePath("/staff/messages");
}

/** Starts (or opens) a conversation with a mobile number, for texting a customer first. */
export async function openChatByPhone(formData: FormData): Promise<void> {
  await requireCoach();
  const phone = normalizeUkPhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim() || null;
  if (!phone) redirect("/staff/messages/new?error=" + encodeURIComponent("Enter a valid UK mobile number."));
  const conversation = await getOrCreateConversationByPhone(phone, name);
  if (!conversation) redirect("/staff/messages/new?error=" + encodeURIComponent("Couldn't open a chat for that number."));
  redirect(`/staff/messages/${conversation.id}`);
}
