import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]{10,200}\]$/;

/**
 * The app registers its push token here after the customer allows
 * notifications (mobile/lib/push.ts), so lib/push.ts can reach them: a
 * reply in chat, a visit booked, an invoice. One token belongs to one
 * login: signing in on a phone moves it over.
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { token, platform } = await readJson<{ token: string; platform: string }>(request);
  if (typeof token !== "string" || !EXPO_TOKEN.test(token) || (platform !== "ios" && platform !== "android")) {
    return mobileJson({ error: "That isn't a push token." }, 400);
  }
  const { error } = await createAdminClient()
    .from("push_tokens")
    .upsert({ token, user_id: caller.user.id, platform, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) return mobileJson({ error: "Couldn't save that." }, 500);
  return mobileJson({ ok: true });
}

/** Signing out: stop pushes to this phone. Needs no sign-in, as the session may already be gone; the token is the proof. */
export async function DELETE(request: Request) {
  const { token } = await readJson<{ token: string }>(request);
  if (typeof token !== "string" || !EXPO_TOKEN.test(token)) return mobileJson({ error: "That isn't a push token." }, 400);
  await createAdminClient().from("push_tokens").delete().eq("token", token);
  return mobileJson({ ok: true });
}
