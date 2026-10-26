import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { getAppointment } from "@/lib/appointments";
import { chargeSavedCard, getPaymentRequest, linkPaymentToVisit, markPaidInPerson, paymentsOn, resendPaymentLink, sendReceipt } from "@/lib/payments";
import { viaPhrase } from "@/lib/visit-notify";

const ACTIONS = ["link", "charge", "in_person", "cash", "bank_transfer", "resend"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * The job page's Payment button: takes one of the customer's invoices for
 * this job. An invoice that isn't on a job yet is put on this one first,
 * then: "link" only (before Tap to Pay, which the app takes itself),
 * charge their saved card, paid in person (card machine, cash or bank
 * transfer, with a receipt sent), or send them the link again.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { jobId, paymentId, action } = await readJson<{ jobId: string; paymentId: string; action: string }>(request);
  if (typeof jobId !== "string" || typeof paymentId !== "string" || !ACTIONS.includes(action as Action)) return mobileJson({ error: "Nothing to do." }, 400);

  const [job, payment] = await Promise.all([getAppointment(jobId), getPaymentRequest(paymentId)]);
  if (!job || !payment) return mobileJson({ error: "That job or payment has gone." }, 404);
  // Only the customer's own invoices can be taken against their job.
  if (payment.appointmentId !== job.id && (!payment.customerId || payment.customerId !== job.customerId)) {
    return mobileJson({ error: "That invoice is for someone else." }, 400);
  }
  if (payment.status !== "open") return mobileJson({ error: payment.status === "paid" ? "That's already paid." : "That payment was cancelled." }, 400);
  if (!payment.appointmentId) await linkPaymentToVisit(payment.id, job.id);

  const staffId = caller.user.id;
  switch (action as Action) {
    case "link":
      return mobileJson({ ok: true });
    case "charge": {
      if (!paymentsOn()) return mobileJson({ error: "Payments aren't set up yet." }, 503);
      const result = await chargeSavedCard(payment.id);
      if (!result.ok) return mobileJson({ error: result.error }, 400);
      const via = await sendReceipt(payment.id, staffId);
      return mobileJson({ ok: true, message: `Charged to their saved card.${via.length ? ` Receipt sent by ${viaPhrase(via)}.` : ""}` });
    }
    case "resend": {
      const via = await resendPaymentLink(payment.id, staffId);
      return via.length ? mobileJson({ ok: true, message: `Sent again by ${viaPhrase(via)}.` }) : mobileJson({ error: "Couldn't reach them: add an email or mobile to their details." }, 400);
    }
    default: {
      const result = await markPaidInPerson(payment.id, action as "in_person" | "cash" | "bank_transfer");
      if (!result.ok) return mobileJson({ error: result.error }, 400);
      const via = await sendReceipt(payment.id, staffId);
      return mobileJson({ ok: true, message: `Marked paid.${via.length ? ` Receipt sent by ${viaPhrase(via)}.` : ""}` });
    }
  }
}
