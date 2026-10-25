"use server";

import { redirect } from "next/navigation";
import { planCheckoutUrl, type PlanBilling } from "@/lib/maintenance-plan";

/** Join: on to Stripe Checkout, monthly or yearly. */
export async function joinPlan(token: string, formData: FormData) {
  const billing: PlanBilling = formData.get("billing") === "year" ? "year" : "month";
  const result = await planCheckoutUrl(token, billing);
  if ("error" in result) redirect(`/plan/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}
