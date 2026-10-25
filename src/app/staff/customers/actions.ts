"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { getOrCreateConversation, getOrCreateConversationByPhone } from "@/lib/chat-db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addCustomerNote,
  createCustomer,
  customerFieldsFromForm,
  deleteCustomerNote,
  getCustomer,
  updateCustomer,
} from "@/lib/customers";

const page = (id: string, params: Record<string, string> = {}) =>
  `/staff/customers/${id}${Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : ""}`;

export async function addCustomer(formData: FormData) {
  await requireStaff("/staff/customers/new");
  const parsed = customerFieldsFromForm(formData);
  if (!parsed.ok) redirect(`/staff/customers/new?error=${encodeURIComponent(parsed.error)}`);
  const created = await createCustomer(parsed.fields);
  if (!created.ok) redirect(`/staff/customers/new?error=${encodeURIComponent(created.error)}`);
  revalidatePath("/staff/customers");
  redirect(page(created.id, { success: "added" }));
}

export async function saveCustomer(id: string, formData: FormData) {
  await requireStaff(`/staff/customers/${id}`);
  const parsed = customerFieldsFromForm(formData);
  if (!parsed.ok) redirect(page(id, { error: parsed.error }));
  const result = await updateCustomer(id, parsed.fields);
  if (!result.ok) redirect(page(id, { error: result.error }));
  revalidatePath(`/staff/customers/${id}`);
  revalidatePath("/staff/customers");
  redirect(page(id, { success: "saved" }));
}

export async function addNote(id: string, formData: FormData) {
  const user = await requireStaff(`/staff/customers/${id}`);
  const ok = await addCustomerNote(id, String(formData.get("body") ?? ""), user.id);
  revalidatePath(`/staff/customers/${id}`);
  redirect(ok ? page(id) + "#notes" : page(id, { error: "Write a note first." }) + "#notes");
}

export async function removeNote(id: string, noteId: string) {
  await requireStaff(`/staff/customers/${id}`);
  await deleteCustomerNote(noteId, id);
  revalidatePath(`/staff/customers/${id}`);
  redirect(page(id) + "#notes");
}

/**
 * Opens this customer's conversation in the inbox: the one they already
 * have, else one by their mobile (so the team can text them), else one for
 * their login.
 */
export async function openCustomerChat(id: string) {
  await requireStaff(`/staff/customers/${id}`);
  const customer = await getCustomer(id);
  if (!customer) redirect("/staff/customers");
  if (customer.conversationId) redirect(`/staff/messages/${customer.conversationId}`);
  const conversation = customer.phoneE164
    ? await getOrCreateConversationByPhone(customer.phoneE164, customer.name)
    : customer.userId
      ? await getOrCreateConversation(customer.userId, customer.name ?? undefined)
      : null;
  if (!conversation) redirect(page(id, { error: "Add a mobile number to start a conversation." }));
  await createAdminClient().from("customers").update({ conversation_id: conversation.id }).eq("id", id);
  redirect(`/staff/messages/${conversation.id}`);
}
