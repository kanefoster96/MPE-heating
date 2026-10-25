"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { isAdmin } from "@/lib/coach";
import { archiveProduct, createProduct, productFromForm, setUpsell, updateProduct } from "@/lib/products";
import { parseReviewUrl, setSetting } from "@/lib/settings";

async function requireAdmin() {
  const user = await requireStaff("/staff/settings");
  if (!(await isAdmin(user.id))) redirect("/staff/schedule");
  return user;
}

const back = (params: Record<string, string>) => `/staff/settings?${new URLSearchParams(params).toString()}#products`;

export async function addProduct(formData: FormData) {
  await requireAdmin();
  const parsed = productFromForm(formData);
  if (!parsed.ok) redirect(back({ error: parsed.error, name: String(formData.get("name") ?? "") }));
  if (!(await createProduct(parsed.fields))) redirect(back({ error: "Couldn't add that." }));
  revalidatePath("/staff/settings");
  redirect(back({ done: `${parsed.fields.name} added.` }));
}

export async function saveProduct(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = productFromForm(formData);
  if (!parsed.ok) redirect(back({ error: parsed.error }));
  if (!(await updateProduct(id, parsed.fields))) redirect(back({ error: "Couldn't save that." }));
  revalidatePath("/staff/settings");
  redirect(back({ done: `${parsed.fields.name} saved.` }));
}

export async function toggleUpsell(id: string, on: boolean) {
  await requireAdmin();
  const result = await setUpsell(id, on);
  revalidatePath("/staff/settings");
  redirect(back(result.ok ? { done: on ? "Now offered at repairs." : "No longer offered at repairs." } : { error: result.error }));
}

export async function removeProduct(id: string) {
  await requireAdmin();
  await archiveProduct(id);
  revalidatePath("/staff/settings");
  redirect(back({ done: "Removed." }));
}

/** The Google Business Profile review link customers are asked to use. */
export async function saveReviewLink(formData: FormData) {
  await requireAdmin();
  const parsed = parseReviewUrl(String(formData.get("reviewUrl") ?? ""));
  const to = (params: Record<string, string>) => `/staff/settings?${new URLSearchParams(params).toString()}#reviews`;
  if (!parsed.ok) redirect(to({ reviewError: parsed.error }));
  if (!(await setSetting("review_url", parsed.url))) redirect(to({ reviewError: "Couldn't save that." }));
  revalidatePath("/staff/settings");
  redirect(to({ reviewDone: parsed.url ? "Review link saved." : "Review link removed." }));
}
