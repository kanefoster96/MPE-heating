import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { customerForUser } from "@/lib/customers";
import { planFor } from "@/lib/maintenance-plan";

/**
 * Delete my account, from inside the app (Apple requires it). Removes the
 * login, and with it the chat and its photos' links and any push tokens
 * (they cascade in supabase/schema.sql). The customer record behind their
 * invoices and visits stays, unlinked, because the business has to keep
 * its accounts; the app says so before they confirm. A plan that's still
 * running has to be cancelled first, so nobody is charged for a plan they
 * can no longer see. The team's logins are removed by an admin instead.
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  if (caller.staff) return mobileJson({ error: "Team logins are removed by an admin on the website." }, 403);

  const customer = caller.user.is_anonymous ? null : await customerForUser(caller.user.id, caller.user.email);
  const plan = customer ? await planFor(customer.id) : null;
  if (plan && (plan.status === "active" || plan.status === "past_due") && !plan.cancelAt) {
    return mobileJson({ error: "You're on the maintenance plan. Cancel it in your account first, then delete your account." }, 409);
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(caller.user.id);
  if (error) {
    console.error("account delete failed", error);
    return mobileJson({ error: "Couldn't delete your account. Please try again, or ask us in chat." }, 500);
  }
  return mobileJson({ ok: true });
}
