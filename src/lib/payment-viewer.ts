import type { User } from "@supabase/supabase-js";
import { getMobileUser } from "@/lib/supabase/mobile";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { CHAT_ON } from "@/lib/chat-on";

/**
 * Who's calling /api/payment-requests (Kanvas Academy's requestViewer): the
 * app sends its session as a Bearer token, the website has its cookie.
 */
export async function requestViewer(request: Request): Promise<{ user: User; staff: boolean } | null> {
  if (!CHAT_ON) return null;
  let user = request.headers.get("authorization") ? await getMobileUser(request) : null;
  if (!user) {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }
  if (!user) return null;
  return { user, staff: await isCoach(user.id) };
}
