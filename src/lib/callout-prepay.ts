import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SITE_URL } from "@/lib/club";
import { londonNow } from "@/lib/schedule-time";
import { getAppointmentByToken, type Appointment } from "@/lib/appointments";
import { CALLOUT_FEE_PENCE, calloutCreditFor, createPaymentRequest, payLink, paymentsForAppointments, type PaymentRequest } from "@/lib/payments";
import { planFor } from "@/lib/maintenance-plan";

/**
 * Paying the £50 call-out ahead, from their phone: a "Pay now" in the
 * booking confirmation (email, app, message), on their visit page and on
 * their job in the app. Nothing's made until they tap it: then the fee's
 * request is made (or the open one found) and they're on the usual pay page
 * (Apple Pay, Google Pay or card). Paying on the day stays just as fine.
 *
 * Not for a plan member (theirs are free), a return visit (the call-out's
 * already been), a visit that's gone, or a call-out that's already paid.
 */

/** The same rules without a database trip, for screens that already have the visit's payments and plan. */
export function prepayable(visit: Appointment, opts: { onPlan: boolean; payments: PaymentRequest[] }): boolean {
  return (
    visit.kind === "callout" &&
    !visit.followUpOf &&
    visit.status === "booked" &&
    visit.day >= londonNow().dateISO &&
    !!visit.customerId &&
    !opts.onPlan &&
    !opts.payments.some((p) => p.kind === "callout_fee" && p.status === "paid")
  );
}

export async function canPrepayCallout(visit: Appointment): Promise<boolean> {
  if (!visit.customerId || visit.kind !== "callout" || visit.followUpOf) return false;
  const [plan, payments, credit] = await Promise.all([
    planFor(visit.customerId).catch(() => null),
    paymentsForAppointments([visit.id]).then((m) => m.get(visit.id) ?? []),
    calloutCreditFor(visit),
  ]);
  const onPlan = plan?.status === "active" || plan?.status === "past_due";
  return !credit && prepayable(visit, { onPlan, payments });
}

/** The link in their messages: it makes the fee's request only when they tap it. */
export function prepayLink(visit: Pick<Appointment, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/visit/${visit.publicToken}/pay`;
}

/** They tapped "Pay now": the fee's pay page, or null if there's nothing to pay ahead. */
export async function startCalloutPrepay(token: string): Promise<string | null> {
  const visit = await getAppointmentByToken(token);
  if (!visit || !(await canPrepayCallout(visit))) return null;
  const open = ((await paymentsForAppointments([visit.id])).get(visit.id) ?? []).find((p) => p.kind === "callout_fee" && p.status === "open");
  if (open) return payLink(open);
  const created = await createPaymentRequest({
    staffId: null,
    customerId: visit.customerId!,
    appointmentId: visit.id,
    kind: "callout_fee",
    description: "Call-out fee",
    lines: [{ description: "Call-out fee", amountPence: CALLOUT_FEE_PENCE }],
    send: false,
  });
  return created.ok ? payLink(created.request) : null;
}

/**
 * A call-out cancelled after they'd paid for it: the fee comes off the
 * visit, so it counts as paid for their next one (calloutCreditFor takes
 * loose fees from the last 60 days). How many there were, for the team.
 */
export async function releasePaidCallout(visitId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .update({ appointment_id: null })
    .eq("appointment_id", visitId)
    .eq("kind", "callout_fee")
    .eq("status", "paid")
    .select("id");
  return data?.length ?? 0;
}
