import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/supabase/mobile";
import { adoptCustomerConversation, claimGuestConversation } from "@/lib/account-claim";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";

/**
 * Someone chatted in the app before signing in: they were an anonymous
 * guest. Once they've signed in with their email code, the app sends the
 * guest's old session here so their conversation comes with them (the
 * website does the same with a cookie, lib/account-claim.ts).
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  if (caller.user.is_anonymous) return mobileJson({ error: "Sign in first." }, 400);
  const { guestToken } = await readJson<{ guestToken: string }>(request);
  if (typeof guestToken !== "string" || !guestToken) return mobileJson({ ok: true });
  const guest = await getMobileUser(new Request(request.url, { headers: { authorization: `Bearer ${guestToken}` } })).catch(() => null);
  if (guest?.is_anonymous) await claimGuestConversation(guest.id, caller.user.id);
  if (!caller.staff) await adoptCustomerConversation(caller.user.id, caller.user.email);
  return mobileJson({ ok: true });
}
