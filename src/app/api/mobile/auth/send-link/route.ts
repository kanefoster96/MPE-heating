import { mobileJson, readJson } from "@/lib/mobile-api";
import { sendSignInLink } from "@/lib/app-sign-in";
import { CHAT_ON } from "@/lib/chat-on";

/**
 * The app's sign-in, step 1 (lib/app-sign-in.ts): emails a "Confirm my
 * email" button. No sign-in needed to ask. `password: true` only for the
 * App Review address, which signs in with a password instead.
 */
export async function POST(request: Request) {
  if (!CHAT_ON) return mobileJson({ error: "Signing in isn't switched on yet." }, 503);
  const { email } = await readJson<{ email: string }>(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const result = await sendSignInLink(typeof email === "string" ? email : "", ip);
  if (!result.ok) return mobileJson({ error: result.error, retryAfter: result.retryAfter }, result.status);
  return mobileJson({ ok: true, password: !!result.password });
}
