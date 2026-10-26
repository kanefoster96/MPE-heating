"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "@/lib/account-delete";
import { CHAT_ON } from "@/lib/chat-on";

/** The "Delete my account" button on /delete-account (lib/account-delete.ts). */
export async function deleteMyAccount(formData: FormData) {
  if (!CHAT_ON) redirect("/delete-account");
  if (formData.get("confirm") !== "yes") redirect("/delete-account?error=" + encodeURIComponent("Tick the box to confirm first."));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/delete-account");
  const result = await deleteAccount(user);
  if (!result.ok) redirect("/delete-account?error=" + encodeURIComponent(result.error));
  await supabase.auth.signOut().catch(() => {});
  redirect("/delete-account?deleted=1");
}
