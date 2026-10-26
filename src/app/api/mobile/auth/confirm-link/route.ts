import { mobileJson, readJson } from "@/lib/mobile-api";
import { sessionTokenFor, spendSignInLink } from "@/lib/app-sign-in";
import { CHAT_ON } from "@/lib/chat-on";

/**
 * The app's sign-in, step 2 (lib/app-sign-in.ts): the app opened from the
 * email's button (`t`), or from the website's "Back to the app" (`h`).
 * Uses the link up and returns a one-time token the app swaps for its
 * session (supabase.auth.verifyOtp). No sign-in needed: the link is the
 * proof.
 */
export async function POST(request: Request) {
  if (!CHAT_ON) return mobileJson({ error: "Signing in isn't switched on yet." }, 503);
  const { t, h } = await readJson<{ t: string; h: string }>(request);
  const email = typeof t === "string" && t ? await spendSignInLink("email", t) : typeof h === "string" && h ? await spendSignInLink("handoff", h) : null;
  if (!email) return mobileJson({ error: "This link has already been used or has run out. Ask for a new one and use that." }, 400);
  const tokenHash = await sessionTokenFor(email);
  if (!tokenHash) return mobileJson({ error: "Something went wrong signing you in. Please ask for a new link." }, 500);
  return mobileJson({ ok: true, email, tokenHash });
}
