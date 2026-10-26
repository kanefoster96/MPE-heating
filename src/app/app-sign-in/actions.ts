"use server";

import { redirect } from "next/navigation";
import { issueHandoff, sessionTokenFor, spendSignInLink } from "@/lib/app-sign-in";

/**
 * The "Confirm my email" tap on /app-sign-in (lib/app-sign-in.ts, step 3):
 * uses the email's link up, signs this browser in through /auth/confirm,
 * and lands on the page that hands back to the app.
 */
export async function confirmAppSignIn(formData: FormData) {
  const t = String(formData.get("t") ?? "");
  const email = await spendSignInLink("email", t);
  if (!email) redirect(`/app-sign-in?t=${encodeURIComponent(t)}&error=1`);
  const [tokenHash, handoff] = await Promise.all([sessionTokenFor(email), issueHandoff(email)]);
  if (!tokenHash || !handoff) redirect(`/app-sign-in?t=${encodeURIComponent(t)}&error=1`);
  const next = `/app-sign-in/done?h=${encodeURIComponent(handoff)}`;
  redirect(`/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(next)}`);
}
