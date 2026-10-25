"use server";

import { redirect } from "next/navigation";
import { checkoutUrl, getPaymentByToken } from "@/lib/payments";

/** Pay: on to Stripe Checkout (Apple Pay, Google Pay or card), with the add-on and saving the card if they ticked them. */
export async function payNow(token: string, formData: FormData) {
  const payment = await getPaymentByToken(token);
  if (!payment) redirect(`/pay/${token}`);
  const result = await checkoutUrl(payment.id, { saveCard: formData.get("saveCard") === "on", addOffers: formData.getAll("addOffer").map(Number) });
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}
