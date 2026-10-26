import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/day-plan";

/**
 * The numbers on Fergal's home page (app/staff/page.tsx), Kanvas Academy's
 * coach dashboard and finance page in one glance: what's coming in, what's
 * owed, the plan, reviews, and where this month's jobs came from. Read
 * straight from the database, so it's what the site has recorded: plan
 * payments are counted from the members' prices, not from Stripe.
 */

export type Snapshot = {
  /** Paid this month: invoices and call-out fees paid in one go, and monthly payments. */
  takenThisMonthPence: number;
  takenLastMonthPence: number;
  /** Invoices and call-out fees waiting to be paid, and what's left on ones paid monthly. */
  owedPence: number;
  unpaidCount: number;
  /** Open over a week, not being paid monthly: worth a chase. */
  overdueCount: number;
  monthlyFailedCount: number;
  plan: { members: number; monthlyPence: number; failed: number; leaving: number };
  reviews: { count: number; average: number | null; toGoogle: number };
  leads: { total: number; booked: number; bySource: { source: string; count: number }[] };
  /** Quotes out with customers, and accepted ones still to book in and invoice. */
  quotes: { open: number; openPence: number; accepted: number };
};

function monthStart(dayISO: string, monthsBack = 0): string {
  const [y, m] = dayISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString();
}

export async function businessSnapshot(todayISO: string): Promise<Snapshot> {
  const admin = createAdminClient();
  const thisMonth = monthStart(todayISO);
  const lastMonth = monthStart(todayISO, 1);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const ninetyDays = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [paid, monthlyIn, open, members, reviews, leads, quotes] = await Promise.all([
    admin.from("payment_requests").select("amount_pence, paid_at").eq("status", "paid").neq("paid_via", "instalments").gte("paid_at", lastMonth),
    admin.from("instalment_payments").select("amount_pence, paid_at").gte("paid_at", lastMonth),
    admin.from("payment_requests").select("id, amount_pence, created_at, plan_status").eq("status", "open"),
    admin.from("plan_members").select("status, billing, price_pence, cancel_at").in("status", ["active", "past_due"]),
    admin.from("job_reviews").select("rating, public_clicked_at").gte("created_at", ninetyDays),
    admin.from("enquiries").select("id, status, traffic_source").gte("created_at", thisMonth),
    admin.from("quotes").select("status, total_pence, balance_request_id, valid_until").in("status", ["sent", "accepted"]),
  ]);
  const quoteRows = (quotes.data ?? []) as { status: string; total_pence: number; balance_request_id: string | null; valid_until: string }[];
  const openQuotes = quoteRows.filter((q) => q.status === "sent" && q.valid_until >= todayISO);

  const sumSince = (rows: { amount_pence: number; paid_at: string }[] | null, from: string, to?: string) =>
    (rows ?? []).filter((r) => r.paid_at >= from && (!to || r.paid_at < to)).reduce((sum, r) => sum + r.amount_pence, 0);
  const paidRows = (paid.data ?? []) as { amount_pence: number; paid_at: string }[];
  const monthlyRows = (monthlyIn.data ?? []) as { amount_pence: number; paid_at: string }[];

  // What's still owed on invoices being paid monthly: their total less what's in.
  const openRows = (open.data ?? []) as { id: string; amount_pence: number; created_at: string; plan_status: string | null }[];
  const onMonthly = openRows.filter((r) => r.plan_status);
  let monthlyPaidSoFar = 0;
  if (onMonthly.length) {
    const { data } = await admin.from("instalment_payments").select("amount_pence").in("payment_request_id", onMonthly.map((r) => r.id));
    monthlyPaidSoFar = (data ?? []).reduce((sum, r) => sum + (r.amount_pence as number), 0);
  }

  const memberRows = (members.data ?? []) as { status: string; billing: string | null; price_pence: number | null; cancel_at: string | null }[];
  const reviewRows = (reviews.data ?? []) as { rating: number; public_clicked_at: string | null }[];
  const leadRows = (leads.data ?? []) as { id: string; status: string; traffic_source: string | null }[];
  const sources = new Map<string, number>();
  for (const l of leadRows) sources.set(l.traffic_source || "Not known", (sources.get(l.traffic_source || "Not known") ?? 0) + 1);

  return {
    takenThisMonthPence: sumSince(paidRows, thisMonth) + sumSince(monthlyRows, thisMonth),
    takenLastMonthPence: sumSince(paidRows, lastMonth, thisMonth) + sumSince(monthlyRows, lastMonth, thisMonth),
    owedPence: openRows.reduce((sum, r) => sum + r.amount_pence, 0) - monthlyPaidSoFar,
    unpaidCount: openRows.filter((r) => !r.plan_status).length,
    overdueCount: openRows.filter((r) => !r.plan_status && r.created_at < weekAgo).length,
    monthlyFailedCount: openRows.filter((r) => r.plan_status === "past_due").length,
    plan: {
      members: memberRows.length,
      monthlyPence: Math.round(memberRows.reduce((sum, m) => sum + (m.price_pence ? (m.billing === "year" ? m.price_pence / 12 : m.price_pence) : 0), 0)),
      failed: memberRows.filter((m) => m.status === "past_due").length,
      leaving: memberRows.filter((m) => m.cancel_at).length,
    },
    reviews: {
      count: reviewRows.length,
      average: reviewRows.length ? Math.round((reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length) * 10) / 10 : null,
      toGoogle: reviewRows.filter((r) => r.public_clicked_at).length,
    },
    quotes: {
      open: openQuotes.length,
      openPence: openQuotes.reduce((sum, q) => sum + q.total_pence, 0),
      accepted: quoteRows.filter((q) => q.status === "accepted" && !q.balance_request_id).length,
    },
    leads: {
      total: leadRows.length,
      booked: leadRows.filter((l) => l.status === "booked" || l.status === "done").length,
      bySource: [...sources.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    },
  };
}

/** The next fortnight's booked visits per day, for the "how full am I" strip. */
export async function bookedPerDay(todayISO: string, days = 14): Promise<{ day: string; count: number; minutes: number }[]> {
  const until = addDays(todayISO, days - 1);
  const { data } = await createAdminClient()
    .from("appointments")
    .select("day, start_minute, end_minute")
    .eq("status", "booked")
    .gte("day", todayISO)
    .lte("day", until);
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(todayISO, i), count: 0, minutes: 0 }));
  for (const r of data ?? []) {
    const slot = out.find((d) => d.day === r.day);
    if (slot) {
      slot.count++;
      slot.minutes += Math.max(0, (r.end_minute as number) - (r.start_minute as number));
    }
  }
  return out;
}

/**
 * What came in each month, oldest first, for the app's Finance screen:
 * invoices and call-out fees paid in one go, plus monthly payments, as the
 * site recorded them. Before Stripe's fees (those are in Stripe).
 */
export async function takenByMonth(todayISO: string, months = 6): Promise<{ month: string; takenPence: number; payments: number }[]> {
  const admin = createAdminClient();
  const from = monthStart(todayISO, months - 1);
  const [paid, monthly] = await Promise.all([
    admin.from("payment_requests").select("amount_pence, paid_at").eq("status", "paid").neq("paid_via", "instalments").gte("paid_at", from),
    admin.from("instalment_payments").select("amount_pence, paid_at").gte("paid_at", from),
  ]);
  const out = Array.from({ length: months }, (_, i) => ({ month: monthStart(todayISO, months - 1 - i).slice(0, 7), takenPence: 0, payments: 0 }));
  for (const r of [...(paid.data ?? []), ...(monthly.data ?? [])] as { amount_pence: number; paid_at: string }[]) {
    const slot = out.find((m) => m.month === r.paid_at.slice(0, 7));
    if (slot) {
      slot.takenPence += r.amount_pence;
      slot.payments++;
    }
  }
  return out;
}
