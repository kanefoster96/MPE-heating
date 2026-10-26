import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SITE_URL } from "@/lib/club";
import { safeNextPath } from "@/lib/safe-next";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";

/**
 * Opens a signed-in website page from the app (Kanvas Academy's
 * web-session): the account page with cards, receipts and boiler details,
 * or one of the team's pages. Makes a one-time sign-in link for the
 * caller's own email that lands on /auth/confirm and carries on to `path`,
 * so they aren't asked to sign in again in the in-app browser. A guest
 * with no email just gets the page.
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { path } = await readJson<{ path: string }>(request);
  const next = safeNextPath(path) ?? "/account";
  const site = CLUB_SITE_URL.replace(/\/$/, "");
  const email = caller.user.is_anonymous ? null : caller.user.email;
  if (!email) return mobileJson({ url: `${site}${next}` });

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return mobileJson({ url: `${site}${next}` });
  return mobileJson({ url: `${site}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent(next)}` });
}
