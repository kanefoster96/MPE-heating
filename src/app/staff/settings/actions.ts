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

/**
 * The maintenance plan's prices, monthly and/or yearly, and any minimum
 * term. A price left blank isn't offered; both blank and the plan can't be
 * joined online. A change applies to people who join from now on: members
 * keep the price they joined at.
 */
export async function savePlanPrices(formData: FormData) {
  await requireAdmin();
  const to = (params: Record<string, string>) => `/staff/settings?${new URLSearchParams(params).toString()}#plan`;
  const pence = (key: string): number | null | "bad" => {
    const raw = String(formData.get(key) ?? "").replace(/[£,\s]/g, "");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 && n <= 5000 ? Math.round(n * 100) : "bad";
  };
  const month = pence("monthPrice");
  const year = pence("yearPrice");
  if (month === "bad" || year === "bad") redirect(to({ planError: "Prices need to be between £1 and £5,000." }));
  const minRaw = String(formData.get("minMonths") ?? "").trim();
  const min = minRaw ? Number(minRaw) : 0;
  if (!Number.isInteger(min) || min < 0 || min > 24) redirect(to({ planError: "The minimum term is a number of months, up to 24." }));
  const ok = (await Promise.all([
    setSetting("plan_month_pence", month ? String(month) : null),
    setSetting("plan_year_pence", year ? String(year) : null),
    setSetting("plan_min_months", min ? String(min) : null),
  ])).every(Boolean);
  if (!ok) redirect(to({ planError: "Couldn't save that." }));
  revalidatePath("/staff/settings");
  redirect(to({ planDone: month || year ? "Plan prices saved." : "Plan prices cleared: the plan can't be joined online until a price is set." }));
}
