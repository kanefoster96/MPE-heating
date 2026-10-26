import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getMobileUser } from "@/lib/supabase/mobile";
import { isAdmin, isCoach } from "@/lib/coach";
import { CHAT_ON } from "@/lib/chat-on";

/**
 * The MPE app's routes (src/app/api/mobile/*): who's calling, from the
 * Bearer token the app sends (lib/supabase/mobile.ts), and JSON replies.
 * Nothing here is cached: every answer is about one person.
 */

export function mobileJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export type MobileCaller = { user: User; staff: boolean; admin: boolean };

/** The signed-in caller (an anonymous guest counts), or the reply to send instead. */
export async function mobileCaller(request: Request): Promise<MobileCaller | NextResponse> {
  if (!CHAT_ON) return mobileJson({ error: "Accounts aren't switched on yet." }, 503);
  const user = await getMobileUser(request).catch(() => null);
  if (!user) return mobileJson({ error: "Please sign in again." }, 401);
  const [staff, admin] = await Promise.all([isCoach(user.id), isAdmin(user.id)]);
  return { user, staff, admin };
}

/** The same, for routes only the team can use. */
export async function mobileStaff(request: Request): Promise<MobileCaller | NextResponse> {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.staff) return mobileJson({ error: "That's for the MPE team." }, 403);
  return caller;
}

/** A JSON body, or {} if there isn't one. */
export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}
