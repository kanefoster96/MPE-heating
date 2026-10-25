import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";
import { CHAT_ON } from "@/lib/chat-on";
import { PREVIOUS_GUEST_COOKIE, claimGuestConversation } from "@/lib/account-claim";

/**
 * Where every Supabase auth email link lands (Kanvas Academy's route): swaps
 * the one-time code for a session, then carries on. For MPE that's the
 * customer's sign-in link to /account. If they were chatting as a website
 * guest in this browser first, that conversation comes with them.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next")) ?? "/account";
  const code = searchParams.get("code");
  if (!CHAT_ON) return NextResponse.redirect(`${origin}/account`);

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (ok) {
    const previousGuest = request.cookies.get(PREVIOUS_GUEST_COOKIE)?.value;
    if (previousGuest) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) await claimGuestConversation(previousGuest, user.id);
    }
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.delete(PREVIOUS_GUEST_COOKIE);
    return response;
  }

  return NextResponse.redirect(
    `${origin}/account?error=` + encodeURIComponent("That link has expired or already been used. Please ask for a new one."),
  );
}
