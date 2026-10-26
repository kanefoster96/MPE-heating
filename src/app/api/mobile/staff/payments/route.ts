import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { formatPence, invoiceNumber, openPaymentRequests, partPaymentsFor, paymentsOn } from "@/lib/payments";
import { getCustomer } from "@/lib/customers";

/**
 * The team's Take payment screen in the app: every open payment, to take
 * by Tap to Pay on the phone (/api/payment-requests/[id]/tap-to-pay) or
 * the rest of the Payment sheet (./[id], ./take). New
 * payments are still made on the website's /staff/payments/new, which the
 * app opens signed in. `terminalLocation` is the Stripe Terminal location
 * the app connects Tap to Pay to.
 */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!paymentsOn()) return mobileJson({ on: false, payments: [], terminalLocation: null });
  const payments = await openPaymentRequests();
  const parts = await partPaymentsFor(payments.map((p) => p.id));
  const paid = (id: string) => (parts.get(id) ?? []).reduce((sum, x) => sum + x.amountPence, 0);
  const names = new Map<string, string | null>();
  await Promise.all(
    [...new Set(payments.map((p) => p.customerId).filter((id): id is string => !!id))].map(async (id) => names.set(id, (await getCustomer(id).catch(() => null))?.name ?? null)),
  );
  return mobileJson({
    on: true,
    terminalLocation: process.env.STRIPE_TERMINAL_LOCATION || null,
    payments: payments.map((p) => ({
      id: p.id,
      number: invoiceNumber(p.number),
      description: p.description,
      // What's left: some may have been paid in cash already.
      amount: formatPence(p.amountPence - paid(p.id)),
      amountPence: p.amountPence - paid(p.id),
      paidSoFar: paid(p.id) ? formatPence(paid(p.id)) : null,
      customer: (p.customerId && names.get(p.customerId)) || null,
      createdAt: p.createdAt,
    })),
  });
}
