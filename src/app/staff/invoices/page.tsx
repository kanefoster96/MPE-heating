import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerLabel, getCustomers } from "@/lib/customers";
import { PAID_VIA_LABEL, formatPence, invoiceNumber, payLink, type PaidVia } from "@/lib/payments";
import { londonParts } from "@/lib/schedule-time";

export const metadata: Metadata = { title: "Invoices" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => {
  const { day, month, year } = londonParts(iso);
  return `${day} ${MONTHS[month]} ${year}`;
};

const TABS = [
  { key: "unpaid", label: "Unpaid" },
  { key: "monthly", label: "Paying monthly" },
  { key: "paid", label: "Paid" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Now, for ages and the 90-day window: read once per request. */
function nowMs(): number {
  return Date.now();
}

type Row = {
  id: string;
  number: number;
  kind: string;
  description: string;
  amount_pence: number;
  status: string;
  paid_at: string | null;
  paid_via: PaidVia | null;
  created_at: string;
  customer_id: string | null;
  appointment_id: string | null;
  reminder_count: number | null;
  plan_status: string | null;
  plan_next_due_on: string | null;
  public_token: string;
};

/**
 * Every call-out fee and invoice in one list (Kanvas Academy's payments
 * page): what's unpaid and how long it's waited, what's being paid monthly
 * and what's left, and what's been paid. Each opens the visit's (or the
 * customer's) Take payment page to chase, charge or mark it paid.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff("/staff/invoices");
  const { show } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === show) ? (show as Tab) : "unpaid";
  const admin = createAdminClient();
  const now = nowMs();
  const since = new Date(now - 90 * 86_400_000).toISOString();

  let query = admin.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (tab === "unpaid") query = query.eq("status", "open").is("plan_status", null);
  if (tab === "monthly") query = query.eq("status", "open").not("plan_status", "is", null);
  if (tab === "paid") query = query.eq("status", "paid").gte("paid_at", since);
  const { data } = await query;
  const rows = (data ?? []) as Row[];

  // What's in on each open one: monthly payments, or part paid (some cash, say).
  const open = rows.filter((r) => r.status === "open");
  const paidIn = new Map<string, number>();
  if (open.length) {
    const { data: ins } = await admin.from("instalment_payments").select("payment_request_id, amount_pence").in("payment_request_id", open.map((r) => r.id));
    for (const i of ins ?? []) paidIn.set(i.payment_request_id as string, (paidIn.get(i.payment_request_id as string) ?? 0) + (i.amount_pence as number));
  }
  const customers = await getCustomers(rows.map((r) => r.customer_id).filter((id): id is string => !!id));
  const total = rows.reduce((sum, r) => sum + (r.status === "open" ? r.amount_pence - (paidIn.get(r.id) ?? 0) : r.amount_pence), 0);
  const days = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/staff" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Invoices</h1>

      <nav className="mt-4 flex gap-1 overflow-x-auto" aria-label="Show">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/staff/invoices?show=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${tab === t.key ? "bg-foreground text-background" : "border border-border hover:border-foreground/40"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-sm text-muted" data-invoices-total>
        {rows.length === 0
          ? tab === "unpaid"
            ? "Nothing unpaid."
            : tab === "monthly"
              ? "No one's paying monthly at the moment."
              : "Nothing paid in the last 90 days."
          : `${rows.length} · ${formatPence(total)} ${tab === "unpaid" ? "to come in" : tab === "monthly" ? "still to pay" : "in the last 90 days"}`}
      </p>

      <ul className="mt-3 flex flex-col gap-2" data-invoices={tab}>
        {rows.map((r) => {
          const c = r.customer_id ? customers.get(r.customer_id) : undefined;
          const left = r.amount_pence - (paidIn.get(r.id) ?? 0);
          const age = days(r.created_at);
          const href = r.appointment_id ? `/staff/payments/new?visit=${r.appointment_id}` : r.customer_id ? `/staff/payments/new?customer=${r.customer_id}` : payLink({ publicToken: r.public_token });
          return (
            <li key={r.id}>
              <Link href={href} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-foreground/40">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {c ? customerLabel(c) : "No customer"} <span className="font-normal text-muted">· {r.kind === "callout_fee" ? "Call-out fee" : invoiceNumber(r.number)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {r.kind === "callout_fee" ? short(r.created_at) : `${r.description} · ${short(r.created_at)}`}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{formatPence(r.status === "open" ? left : r.amount_pence)}</span>
                  <span className={`block text-xs ${r.plan_status === "past_due" || (tab === "unpaid" && age >= 7) ? "font-semibold text-danger" : "text-muted"}`}>
                    {tab === "paid"
                      ? `Paid ${r.paid_at ? short(r.paid_at) : ""}${r.paid_via ? ` · ${PAID_VIA_LABEL[r.paid_via]}` : ""}`
                      : tab === "monthly"
                        ? r.plan_status === "past_due"
                          ? "Last payment failed"
                          : r.plan_status === "stopped"
                            ? "Stopped"
                            : `left of ${formatPence(r.amount_pence)}${r.plan_next_due_on ? ` · next ${short(`${r.plan_next_due_on}T12:00:00Z`)}` : ""}`
                        : `${paidIn.get(r.id) ? `left of ${formatPence(r.amount_pence)} · ` : ""}${age === 0 ? "Today" : `${age} day${age === 1 ? "" : "s"}`}${r.reminder_count ? ` · reminded ${r.reminder_count === 1 ? "once" : `${Math.min(r.reminder_count, 2)} times`}` : ""}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
