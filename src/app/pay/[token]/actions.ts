"use server";

import { redirect } from "next/navigation";
import { checkoutUrl, getPaymentByToken } from "@/lib/payments";
import { changeCardUrl, payOffUrl, startMonthlyUrl } from "@/lib/instalments";

/** Pay: on to Stripe Checkout (Apple Pay, Google Pay or card), with the add-on and saving the card if they ticked them. */
export async function payNow(token: string, formData: FormData) {
  const payment = await getPaymentByToken(token);
  if (!payment) redirect(`/pay/${token}`);
  const result = await checkoutUrl(payment.id, { saveCard: formData.get("saveCard") === "on", addOffers: formData.getAll("addOffer").map(Number) });
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

/** Pay monthly, as Fergal offered: today's payment by Checkout, which saves their card for the dates after. */
export async function payMonthly(token: string) {
  const result = await startMonthlyUrl(token);
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

/** Pay some off now, or the rest: the amount in pounds, from the form. */
export async function payOff(token: string, formData: FormData) {
  const pounds = Number(String(formData.get("amount") ?? "").replace(/[£,\s]/g, ""));
  const result = await payOffUrl(token, Number.isFinite(pounds) ? Math.round(pounds * 100) : 0);
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}#monthly`);
  redirect(result.url);
}

/** A new card for the monthly payments. */
export async function changeCard(token: string) {
  const result = await changeCardUrl(token);
  if ("error" in result) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}#monthly`);
  redirect(result.url);
}
