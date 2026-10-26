import { createAdminClient } from "@/lib/supabase/admin";
import { customerLabel, getCustomer, getCustomers } from "@/lib/customers";
import { instalmentProgress, recordInPersonInstalment, restartInstalments, stopInstalments } from "@/lib/instalments";
import {
  PAID_VIA_LABEL,
  cancelPaymentRequest,
  formatPence,
  getPaymentRequest,
  invoiceNumber,
  partPaymentsFor,
  payLink,
  resendPaymentLink,
  sendReceipt,
  type PaidVia,
  type PaymentRequest,
} from "@/lib/payments";
import { viaPhrase } from "@/lib/visit-notify";

/**
 * Invoices in the app (mobile/app/invoices.tsx and invoice/[id].tsx): the
 * website's /staff/invoices and what it does with each one. Unpaid,
 * paying monthly and paid (the last 90 days); each with what's left, and
 * on its own page: take it, send the link again, cancel, and for one paid
 * monthly, record a payment, stop or restart the payments.
 */

export const INVOICE_TABS = ["unpaid", "monthly", "paid"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

const SHORT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

type Row = { id: string; customer_id: string | null; kind: string; number: number; description: string; amount_pence: number; status: string; paid_at: string | null; paid_via: PaidVia | null; created_at: string; plan_status: string | null; plan_next_due_on: string | null; reminder_count: number | null };

export async function invoiceList(tab: InvoiceTab) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  let query = admin.from("payment_requests").select("id, customer_id, kind, number, description, amount_pence, status, paid_at, paid_via, created_at, plan_status, plan_next_due_on, reminder_count").order("created_at", { ascending: false }).limit(300);
  if (tab === "unpaid") query = query.eq("status", "open").is("plan_status", null);
  if (tab === "monthly") query = query.eq("status", "open").not("plan_status", "is", null);
  if (tab === "paid") query = query.eq("status", "paid").gte("paid_at", since);
  const rows = ((await query).data ?? []) as Row[];
  const open = rows.filter((r) => r.status === "open");
  const parts = await partPaymentsFor(open.map((r) => r.id));
  const paid = (id: string) => (parts.get(id) ?? []).reduce((sum, p) => sum + p.amountPence, 0);
  const customers = await getCustomers(rows.map((r) => r.customer_id).filter((id): id is string => !!id));
  const now = Date.now();
  const items = rows.map((r) => {
    const c = r.customer_id ? customers.get(r.customer_id) : undefined;
    const left = r.amount_pence - paid(r.id);
    const age = Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000);
    return {
      id: r.id,
      customer: c ? customerLabel(c) : "No customer",
      title: r.kind === "callout_fee" ? "Call-out fee" : `${invoiceNumber(r.number)} · ${r.description}`,
      amount: formatPence(r.status === "open" ? left : r.amount_pence),
      overdue: (tab === "unpaid" && age >= 7) || r.plan_status === "past_due",
      detail:
        tab === "paid"
          ? `Paid ${r.paid_at ? SHORT.format(new Date(r.paid_at)) : ""}${r.paid_via ? ` · ${PAID_VIA_LABEL[r.paid_via]}` : ""}`
          : tab === "monthly"
            ? r.plan_status === "past_due"
              ? "Last payment failed"
              : r.plan_status === "stopped"
                ? "Stopped"
                : `left of ${formatPence(r.amount_pence)}${r.plan_next_due_on ? ` · next ${SHORT.format(new Date(`${r.plan_next_due_on}T12:00:00Z`))}` : ""}`
            : `${paid(r.id) ? `left of ${formatPence(r.amount_pence)} · ` : ""}${age === 0 ? "Today" : `${age} day${age === 1 ? "" : "s"}`}${r.reminder_count ? ` · reminded ${r.reminder_count === 1 ? "once" : "twice"}` : ""}`,
    };
  });
  const total = rows.reduce((sum, r) => sum + (r.status === "open" ? r.amount_pence - paid(r.id) : r.amount_pence), 0);
  return { tab, total: formatPence(total), count: rows.length, items };
}

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

export async function invoiceDetail(id: string) {
  const p = await getPaymentRequest(id);
  if (!p) return null;
  const customer = p.customerId ? await getCustomer(p.customerId) : null;
  const [parts, progress] = await Promise.all([partPaymentsFor([p.id]), p.planStatus ? instalmentProgress([p]) : Promise.resolve(new Map())]);
  const paidIn = parts.get(p.id) ?? [];
  const paidPence = paidIn.reduce((sum, x) => sum + x.amountPence, 0);
  const plan = progress.get(p.id);
  return {
    id: p.id,
    number: p.kind === "callout_fee" ? "Call-out fee" : invoiceNumber(p.number),
    description: p.description,
    customer: customer ? { id: customer.id, name: customerLabel(customer) } : null,
    appointmentId: p.appointmentId,
    created: DATE.format(new Date(p.createdAt)),
    lines: p.lines.map((l) => ({ description: l.description, amount: formatPence(l.amountPence) })),
    total: formatPence(p.amountPence),
    status: p.status,
    paid: p.status === "paid" ? `Paid ${p.paidAt ? DATE.format(new Date(p.paidAt)) : ""}${p.paidVia ? ` · ${PAID_VIA_LABEL[p.paidVia]}` : ""}` : null,
    left: p.status === "open" ? formatPence(p.amountPence - paidPence) : null,
    parts: paidIn.map((x) => ({ when: DATE.format(new Date(x.paidAt)), amount: formatPence(x.amountPence), via: x.paidVia && x.paidVia in PAID_VIA_LABEL ? PAID_VIA_LABEL[x.paidVia as PaidVia] : null })),
    monthly: p.planStatus
      ? {
          status: p.planStatus,
          next: plan?.nextOn && plan.nextPence ? `${formatPence(plan.nextPence)} on ${DATE.format(new Date(`${plan.nextOn}T12:00:00Z`))}` : null,
          monthly: p.planMonthlyPence ? formatPence(p.planMonthlyPence) : null,
        }
      : null,
    reminders: p.reminderCount,
    link: payLink(p),
    canCancel: p.status === "open" && paidPence === 0 && (!p.planStatus || p.planStatus === "stopped" || p.planStatus === "completed"),
  };
}

export const INVOICE_ACTIONS = ["resend", "cancel", "stop_monthly", "restart_monthly", "monthly_cash", "monthly_bank_transfer", "monthly_in_person", "receipt"] as const;
export type InvoiceAction = (typeof INVOICE_ACTIONS)[number];

/** The website's buttons on an invoice: the link again, cancel, monthly payments (stop, restart, one taken in person), the receipt again. */
export async function invoiceAction(id: string, action: InvoiceAction, amountPence: number | null, staffId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const p: PaymentRequest | null = await getPaymentRequest(id);
  if (!p) return { ok: false, error: "That invoice has gone." };
  switch (action) {
    case "resend": {
      const via = await resendPaymentLink(id, staffId);
      return via.length ? { ok: true, message: `Sent again by ${viaPhrase(via)}.` } : { ok: false, error: "Couldn't reach them: add an email or mobile to their details." };
    }
    case "receipt": {
      const via = await sendReceipt(id, staffId);
      return via.length ? { ok: true, message: `Receipt sent by ${viaPhrase(via)}.` } : { ok: false, error: "Couldn't reach them: add an email or mobile to their details." };
    }
    case "cancel": {
      const result = await cancelPaymentRequest(id);
      return result.ok ? { ok: true, message: "Cancelled." } : result;
    }
    case "stop_monthly": {
      const result = await stopInstalments(id);
      return result.ok ? { ok: true, message: "Monthly payments stopped. Anything left can still be paid off." } : result;
    }
    case "restart_monthly": {
      const result = await restartInstalments(id);
      return result.ok ? { ok: true, message: "Monthly payments restarted." } : result;
    }
    default: {
      const via = action.slice("monthly_".length) as "cash" | "bank_transfer" | "in_person";
      const result = await recordInPersonInstalment(id, amountPence ?? 0, via, staffId);
      return result.ok ? { ok: true, message: "Recorded: it's come off what they owe." } : result;
    }
  }
}
