import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getOrCreateConversationByPhone } from "@/lib/chat-db";
import { getCustomer } from "@/lib/customers";
import { normalizeUkPhone } from "@/lib/twilio";
import { isTeamConversation } from "@/lib/team-chat";
import { CATEGORY_LABEL, ENQUIRY_STATUSES, STATUS_LABEL, enquiriesForConversation, issueLine } from "@/lib/enquiries";

/**
 * The team's chat, for the app as on the website (/staff/messages): a
 * conversation's number for texting, starting a chat with a number or a
 * customer, and the booking enquiries in a conversation with where each is
 * up to.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** A conversation's number for texting: the website's composer saves it the same way. */
export async function setConversationPhone(conversationId: string, phone: string): Promise<Result<{ phone: string }>> {
  const normalized = normalizeUkPhone(phone);
  if (!normalized) return { ok: false, error: "That doesn't look like a valid phone number." };
  if (await isTeamConversation(conversationId)) return { ok: false, error: "The team chat has no phone number." };
  const { error } = await createAdminClient().from("chat_conversations").update({ phone: normalized }).eq("id", conversationId);
  if (error) {
    // Another conversation already has this number: likely the same person under another login.
    if (error.code === "23505") return { ok: false, error: "Another conversation already uses that number." };
    return { ok: false, error: "Could not save that number." };
  }
  return { ok: true, phone: normalized };
}

/** Texting someone first: their conversation by mobile, made if it's new ("Text a customer first"). */
export async function openChatByPhone(phone: string, name: string | null): Promise<Result<{ id: string }>> {
  const normalized = normalizeUkPhone(phone);
  if (!normalized) return { ok: false, error: "Enter a valid UK mobile number." };
  const conversation = await getOrCreateConversationByPhone(normalized, name?.trim() || null);
  return conversation ? { ok: true, id: conversation.id } : { ok: false, error: "Couldn't open a chat for that number." };
}

/** A customer's conversation: the one they have, else one by their mobile, else one for their login (the website's openCustomerChat). */
export async function openCustomerChat(customerId: string): Promise<Result<{ id: string }>> {
  const customer = await getCustomer(customerId);
  if (!customer) return { ok: false, error: "That customer has gone." };
  if (customer.conversationId) return { ok: true, id: customer.conversationId };
  const conversation = customer.phoneE164
    ? await getOrCreateConversationByPhone(customer.phoneE164, customer.name)
    : customer.userId
      ? await getOrCreateConversation(customer.userId, customer.name ?? undefined)
      : null;
  if (!conversation) return { ok: false, error: "Add a mobile number to start a conversation." };
  await createAdminClient().from("customers").update({ conversation_id: conversation.id }).eq("id", customerId);
  return { ok: true, id: conversation.id };
}

/** The booking enquiries in a conversation, newest first, each with where it's up to. */
export async function enquiryCards(conversationId: string) {
  const list = await enquiriesForConversation(conversationId).catch(() => []);
  return list.map((e) => ({
    id: e.id,
    category: CATEGORY_LABEL[e.category],
    status: e.status,
    sameDay: e.sameDay,
    postcode: e.postcode,
    issue: issueLine(e),
  }));
}

export const ENQUIRY_STEPS = ENQUIRY_STATUSES.map((key) => ({ key, label: STATUS_LABEL[key] }));
