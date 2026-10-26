"use server";

import { redirect } from "next/navigation";
import { acceptQuote, declineQuote, depositCheckoutUrl } from "@/lib/quotes";

/** Accept: with the deposit through Stripe Checkout, or straight away when there's none. */
export async function acceptThisQuote(token: string) {
  const back = (q: string) => `/quote/${token}?${q}`;
  const withDeposit = await depositCheckoutUrl(token);
  if ("url" in withDeposit) redirect(withDeposit.url);
  if (withDeposit.error !== "This quote has no deposit.") redirect(back(`error=${encodeURIComponent(withDeposit.error)}`));
  const result = await acceptQuote(token);
  redirect(result.ok ? back("accepted=1") : back(`error=${encodeURIComponent(result.error)}`));
}

export async function declineThisQuote(token: string, formData: FormData) {
  const result = await declineQuote(token, String(formData.get("reason") ?? ""));
  redirect(`/quote/${token}?${result.ok ? "declined=1" : `error=${encodeURIComponent(result.error)}`}`);
}
