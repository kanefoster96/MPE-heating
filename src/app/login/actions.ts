"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// Only ever a same-site path we generated ourselves (e.g. `/staff/messages/<id>`)
// — reject anything else so this can't be turned into an open redirect.
function safeNext(next: FormDataEntryValue | null): string | null {
  return safeNextPath(next);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const suffix = next ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=${encodeURIComponent(error.message)}${suffix}`);
  }

  redirect(next ?? "/staff/messages");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
