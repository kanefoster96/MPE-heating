import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerForUser } from "@/lib/customers";
import { planFor } from "@/lib/maintenance-plan";
import { isCoach } from "@/lib/coach";

/**
 * Delete my account: in the app (Apple requires it) and on the website's
 * /delete-account page (Google asks for one). Removes the login, and with
 * it the chat, its photos' links and any push tokens (they cascade in
 * supabase/schema.sql). The customer record behind their invoices and
 * visits stays, unlinked, because the business has to keep its accounts;
 * both places say so before they confirm. A plan that's still running has
 * to be cancelled first, so nobody is charged for a plan they can no
 * longer see. The team's logins are removed by an admin instead.
 */
export async function deleteAccount(user: User): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (await isCoach(user.id)) return { ok: false, error: "Team logins are removed by an admin on the website.", status: 403 };
  const customer = user.is_anonymous ? null : await customerForUser(user.id, user.email);
  const plan = customer ? await planFor(customer.id) : null;
  if (plan && (plan.status === "active" || plan.status === "past_due") && !plan.cancelAt) {
    return { ok: false, error: "You're on the maintenance plan. Cancel it in your account first, then delete your account.", status: 409 };
  }
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete failed", error);
    return { ok: false, error: "Couldn't delete your account. Please try again, or get in touch and we'll do it for you.", status: 500 };
  }
  return { ok: true };
}
