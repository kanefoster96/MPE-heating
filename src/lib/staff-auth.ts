import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { CHAT_ON } from "@/lib/chat-on";

/**
 * The team's pages and actions: signed in, and an admin or engineer
 * (user_roles). Anyone else goes to the login, or home. `next` is where to
 * come back to after logging in.
 */
export async function requireStaff(next = "/staff/messages") {
  if (!CHAT_ON) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!(await isCoach(user.id))) redirect("/");
  return user;
}
