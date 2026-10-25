"use server";

import { redirect } from "next/navigation";
import { checkoutUrl, getPaymentByToken } from "@/lib/payments";
import { instalmentCheckoutUrl } from "@/lib/instalments";
import { billingPortalUrl } from "@/lib/maintenance-plan";

/** Pay: on to Stripe Checkout (Apple Pay, Google Pay or card), with the add-on and saving the card if they ticked them. */
export async function payNow(token: string, formData: FormData) {
  const payment = await getPaymentByToken(token);
  if (!payment) redirect(`/pay/${token}`);
  const result = await checkoutUrl(payment.id, { saveCard: formData.get("saveCard") === "on", addOffers: formData.getAll("addOffer").map(Number) });
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

/** Pay monthly, as Fergal offered: on to Stripe Checkout to set it up. */
export async function payMonthly(token: string) {
  const result = await instalmentCheckoutUrl(token);
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

/** Change the card the monthly payments come from (Stripe's billing page). */
export async function changeCard(token: string) {
  const payment = await getPaymentByToken(token);
  const url = payment?.customerId && payment.planStatus ? await billingPortalUrl(payment.customerId, `/pay/${token}`) : null;
  if (!url) redirect(`/pay/${token}?error=${encodeURIComponent("Couldn't open that just now. Please try again, or call us.")}`);
  redirect(url);
}
