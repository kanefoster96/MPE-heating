import { getAppointment } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { toJobPayment, type JobPayment } from "@/lib/app-jobs";
import {
  chargeSavedCard,
  formatPence,
  getPaymentRequest,
  linkPaymentToVisit,
  markPaidInPerson,
  paidTowards,
  paymentsOn,
  recordPartPayment,
  resendPaymentLink,
  savedCardFor,
  sendReceipt,
} from "@/lib/payments";
import { viaPhrase } from "@/lib/visit-notify";

/**
 * The app's Payment sheet (mobile/components/payment-sheet.tsx), from a
 * job's page or the Payment tab. Taking it: Tap to Pay or a card reader
 * (the app collects those itself), the card they saved (once Fergal's
 * checked with them), the link to their chat, text and email, or cash,
 * all of it or part, the rest to come by card or the link.
 */

export type SheetContext = {
  jobId: string | null;
  customerName: string | null;
  on: boolean;
  terminalLocation: string | null;
  savedCard: { brand: string; last4: string } | null;
  choices: JobPayment[];
};

/** One invoice on its own (the Payment tab): what the sheet needs to take it. */
export async function paymentSheetFor(id: string): Promise<SheetContext | null> {
  const p = await getPaymentRequest(id);
  if (!p || p.status !== "open") return null;
  const [customer, paid, visit] = await Promise.all([
    p.customerId ? getCustomer(p.customerId) : Promise.resolve(null),
    paidTowards(p.id),
    p.appointmentId ? getAppointment(p.appointmentId) : Promise.resolve(null),
  ]);
  const card = customer && paymentsOn() ? await savedCardFor(customer) : null;
  return {
    jobId: visit?.id ?? null,
    customerName: customer?.name ?? null,
    on: paymentsOn(),
    terminalLocation: process.env.STRIPE_TERMINAL_LOCATION || null,
    savedCard: card ? { brand: card.brand, last4: card.last4 } : null,
    choices: [toJobPayment(p, paid, visit ? "this" : "none")],
  };
}

export const TAKE_ACTIONS = ["link", "charge", "cash", "bank_transfer", "resend"] as const;
export type TakeAction = (typeof TAKE_ACTIONS)[number];

/**
 * One of the sheet's buttons. With a job, an invoice that isn't on a job
 * yet is put on it first, and only the job's customer's invoices can be
 * taken there. "link" just does that (before Tap to Pay or the reader).
 * Cash with an amount under what's left is a part payment.
 */
export async function takePayment(params: {
  paymentId: string;
  jobId: string | null;
  action: TakeAction;
  amountPence: number | null;
  staffId: string;
}): Promise<{ ok: true; message: string; leftPence: number } | { ok: false; error: string; status: number }> {
  const payment = await getPaymentRequest(params.paymentId);
  if (!payment) return { ok: false, error: "That payment has gone.", status: 404 };
  if (params.jobId) {
    const job = await getAppointment(params.jobId);
    if (!job) return { ok: false, error: "That job has gone.", status: 404 };
    if (payment.appointmentId !== job.id && (!payment.customerId || payment.customerId !== job.customerId)) return { ok: false, error: "That invoice is for someone else.", status: 400 };
  }
  if (payment.status !== "open") return { ok: false, error: payment.status === "paid" ? "That's already paid." : "That payment was cancelled.", status: 400 };
  if (params.jobId && !payment.appointmentId) await linkPaymentToVisit(payment.id, params.jobId);

  const receipt = async (lead: string) => {
    const via = await sendReceipt(payment.id, params.staffId);
    return `${lead}${via.length ? ` Receipt sent by ${viaPhrase(via)}.` : ""}`;
  };
  switch (params.action) {
    case "link":
      return { ok: true, message: "", leftPence: payment.amountPence - (await paidTowards(payment.id)) };
    case "charge": {
      if (!paymentsOn()) return { ok: false, error: "Payments aren't set up yet.", status: 503 };
      const result = await chargeSavedCard(payment.id);
      if (!result.ok) return { ok: false, error: result.error, status: 400 };
      return { ok: true, message: await receipt("Charged to their saved card."), leftPence: 0 };
    }
    case "resend": {
      const via = await resendPaymentLink(payment.id, params.staffId);
      if (!via.length) return { ok: false, error: "Couldn't reach them: add an email or mobile to their details.", status: 400 };
      return { ok: true, message: `Sent to their ${viaPhrase(via)}.`, leftPence: payment.amountPence - (await paidTowards(payment.id)) };
    }
    case "bank_transfer": {
      const result = await markPaidInPerson(payment.id, "bank_transfer", params.staffId);
      if (!result.ok) return { ok: false, error: result.error, status: 400 };
      return { ok: true, message: await receipt("Marked paid by bank transfer."), leftPence: 0 };
    }
    case "cash": {
      const left = payment.amountPence - (await paidTowards(payment.id));
      const amount = params.amountPence ?? left;
      const result = await recordPartPayment(payment.id, amount, "cash", params.staffId);
      if (!result.ok) return { ok: false, error: result.error, status: 400 };
      if (result.paidOff) return { ok: true, message: await receipt("Paid in cash."), leftPence: 0 };
      return { ok: true, message: `${formatPence(result.leftPence)} left to take by card or the link.`, leftPence: result.leftPence };
    }
  }
}
