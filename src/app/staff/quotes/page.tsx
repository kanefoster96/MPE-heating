import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { customerLabel, getCustomers } from "@/lib/customers";
import { longDate } from "@/lib/day-plan";
import { formatPence } from "@/lib/payments";
import { QUOTE_STATUS_LABEL, listQuotes, quoteNumber } from "@/lib/quotes";
import { londonNow } from "@/lib/schedule-time";

export const metadata: Metadata = { title: "Quotes" };

const TABS = [
  { key: "open", label: "Waiting for them" },
  { key: "accepted", label: "Accepted: to do" },
  { key: "closed", label: "Last 90 days" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * Every quote: the ones out with customers (and whether they've opened
 * them), the accepted ones to book in and invoice, and the last 90 days.
 * New quotes start from a quote visit or a customer's page.
 */
export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff("/staff/quotes");
  const { show } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === show) ? (show as Tab) : "open";
  const quotes = await listQuotes(tab);
  const customers = await getCustomers(quotes.map((q) => q.customerId));
  const today = londonNow().dateISO;
  const total = quotes.reduce((sum, q) => sum + q.totalPence, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/staff" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Quotes</h1>
      <p className="mt-1 text-sm text-muted">Write one from a quote visit on the schedule, or from a customer&rsquo;s page.</p>

      <nav className="mt-4 flex gap-1 overflow-x-auto" aria-label="Show">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/staff/quotes?show=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${tab === t.key ? "bg-foreground text-background" : "border border-border hover:border-foreground/40"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-sm text-muted">
        {quotes.length === 0 ? "None." : `${quotes.length} · ${formatPence(total)}`}
      </p>
      <ul className="mt-3 flex flex-col gap-2" data-quotes={tab}>
        {quotes.map((q) => {
          const c = customers.get(q.customerId);
          const ranOut = q.status === "sent" && q.validUntil < today;
          return (
            <li key={q.id}>
              <Link href={`/staff/quotes/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-foreground/40">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {c ? customerLabel(c) : "Customer"} <span className="font-normal text-muted">· {quoteNumber(q.number)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">{q.title}</span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{formatPence(q.totalPence)}</span>
                  <span className={`block text-xs ${q.status === "accepted" ? "font-semibold text-success" : ranOut || q.status === "declined" ? "text-danger" : "text-muted"}`}>
                    {q.status === "sent"
                      ? ranOut
                        ? "Ran out"
                        : `${q.viewedAt ? "Opened" : "Not opened yet"} · until ${longDate(q.validUntil).replace(/^\w+ /, "")}`
                      : QUOTE_STATUS_LABEL[q.status]}
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
