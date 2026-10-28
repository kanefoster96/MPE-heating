import { NextResponse } from "next/server";
import { CHAT_ON } from "@/lib/chat-on";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { findCustomerForUser } from "@/lib/customers";
import { planFor } from "@/lib/maintenance-plan";

/**
 * Who's booking, for the booking forms (components/StepFlow.tsx): a
 * customer signed in on the website, or opened from the app signed in
 * (mobile/lib/open-link.ts openSignedIn), doesn't type their details again.
 * Nothing for a guest, the team, or anyone signed out.
 */
export async function GET() {
  if (!CHAT_ON) return NextResponse.json({ known: null });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous || (await isCoach(user.id))) return NextResponse.json({ known: null });
    // Read only: opening a form mustn't make a customer record.
    const customer = await findCustomerForUser(user.id, user.email);
    // On the maintenance plan: the form says their call-out's free instead of the £50.
    const plan = customer ? await planFor(customer.id).catch(() => null) : null;
    return NextResponse.json(
      {
        known: {
          name: customer?.name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
          address: customer?.address ?? "",
          postcode: customer?.postcode ?? "",
          email: customer?.email ?? user.email ?? "",
          phone: customer?.phone ?? "",
          onPlan: plan?.status === "active" || plan?.status === "past_due",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ known: null });
  }
}
