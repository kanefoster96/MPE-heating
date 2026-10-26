import { createAdminClient } from "@/lib/supabase/admin";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { getCoachRoster } from "@/lib/coach";
import { getSetting, setSetting } from "@/lib/settings";
import { renderEmailLayout } from "@/lib/emails/layout";
import { CLUB_SITE_URL } from "@/lib/club";
import { formatPence } from "@/lib/payments";

/**
 * The month in numbers, emailed to the admins on the 1st (Kanvas One's
 * "monthly report: what came in, what you won"; Kanvas Academy's monthly
 * numbers email). What the site recorded: money in, jobs done, new jobs
 * and where they came from, quotes sent and won, the plan, reviews and
 * referrals. Ad spend isn't here: that's in Meta Ads Manager.
 */

export type MonthNumbers = {
  month: string;
  takenPence: number;
  payments: number;
  jobsDone: number;
  enquiries: number;
  bySource: { source: string; count: number }[];
  quotesSent: number;
  quotesSentPence: number;
  quotesWon: number;
  quotesWonPence: number;
  planMembers: number;
  planJoined: number;
  planLeft: number;
  reviews: number;
  reviewAverage: number | null;
  toGoogle: number;
  referrals: number;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** "2026-10" → the month before. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export async function monthNumbers(month: string): Promise<MonthNumbers> {
  const admin = createAdminClient();
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);

  const [paid, monthly, jobs, enquiries, sent, won, members, joined, left, reviews, referrals] = await Promise.all([
    admin.from("payment_requests").select("amount_pence").eq("status", "paid").neq("paid_via", "instalments").gte("paid_at", from).lt("paid_at", to),
    admin.from("instalment_payments").select("amount_pence").gte("paid_at", from).lt("paid_at", to),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("status", "done").gte("day", fromDay).lt("day", toDay),
    admin.from("enquiries").select("traffic_source").gte("created_at", from).lt("created_at", to),
    admin.from("quotes").select("total_pence").gte("sent_at", from).lt("sent_at", to),
    admin.from("quotes").select("total_pence").gte("accepted_at", from).lt("accepted_at", to),
    admin.from("plan_members").select("id", { count: "exact", head: true }).in("status", ["active", "past_due"]),
    admin.from("plan_members").select("id", { count: "exact", head: true }).gte("started_at", from).lt("started_at", to),
    admin.from("plan_members").select("id", { count: "exact", head: true }).gte("ended_at", from).lt("ended_at", to),
    admin.from("job_reviews").select("rating, public_clicked_at").gte("created_at", from).lt("created_at", to),
    admin.from("referrals").select("id", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to),
  ]);
  const sum = (rows: { amount_pence?: number; total_pence?: number }[] | null) => (rows ?? []).reduce((s, r) => s + (r.amount_pence ?? r.total_pence ?? 0), 0);
  const sources = new Map<string, number>();
  for (const e of enquiries.data ?? []) {
    const s = (e.traffic_source as string | null) || "Not known";
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }
  const ratings = (reviews.data ?? []) as { rating: number; public_clicked_at: string | null }[];
  return {
    month,
    takenPence: sum(paid.data) + sum(monthly.data),
    payments: (paid.data?.length ?? 0) + (monthly.data?.length ?? 0),
    jobsDone: jobs.count ?? 0,
    enquiries: enquiries.data?.length ?? 0,
    bySource: [...sources.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    quotesSent: sent.data?.length ?? 0,
    quotesSentPence: sum(sent.data),
    quotesWon: won.data?.length ?? 0,
    quotesWonPence: sum(won.data),
    planMembers: members.count ?? 0,
    planJoined: joined.count ?? 0,
    planLeft: left.count ?? 0,
    reviews: ratings.length,
    reviewAverage: ratings.length ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null,
    toGoogle: ratings.filter((r) => r.public_clicked_at).length,
    referrals: referrals.count ?? 0,
  };
}

function reportHtml(n: MonthNumbers): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;color:#5b6472">${label}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;font-weight:700;color:#1f2a3a;text-align:right">${value}</td></tr>`;
  const rows = [
    row("Money in", `${formatPence(n.takenPence)} (${n.payments} payment${n.payments === 1 ? "" : "s"})`),
    row("Jobs done", String(n.jobsDone)),
    row("New jobs (booking forms)", String(n.enquiries)),
    ...n.bySource.map((s) => row(`&nbsp;&nbsp;from ${s.source}`, String(s.count))),
    row("Quotes sent", `${n.quotesSent} (${formatPence(n.quotesSentPence)})`),
    row("Quotes won", `${n.quotesWon} (${formatPence(n.quotesWonPence)})`),
    row("Plan members", `${n.planMembers} (${n.planJoined} joined, ${n.planLeft} left)`),
    row("Reviews", n.reviews ? `${n.reviews}, average ${n.reviewAverage?.toFixed(1)} ★, ${n.toGoogle} to Google` : "None"),
    row("Referrals", String(n.referrals)),
  ].join("");
  return renderEmailLayout({
    previewText: `${monthName(n.month)}: ${formatPence(n.takenPence)} in, ${n.jobsDone} jobs done`,
    heading: `${monthName(n.month)} in numbers`,
    bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">${rows}</table><p style="margin:0;font-size:13px;color:#5b6472">What the site recorded. Ad spend is in Meta Ads Manager.</p>`,
    ctaLabel: "Open Home",
    ctaUrl: `${CLUB_SITE_URL.replace(/\/$/, "")}/staff`,
  });
}

/** Sends a month's numbers to these addresses. True when Resend took it. */
export async function sendMonthReport(month: string, to: string[]): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !to.length) return false;
  const n = await monthNumbers(month);
  const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject: `MPE: ${monthName(month)} in numbers`, html: reportHtml(n) });
  if (error) console.error("monthly-report: send failed", error);
  return !error;
}

/** On the 1st (lib/follow-up-sweep.ts): last month's numbers to every admin, once. */
export async function sendDueMonthReport(todayISO: string): Promise<boolean> {
  if (todayISO.slice(8, 10) !== "01") return false;
  const month = previousMonth(todayISO.slice(0, 7));
  if ((await getSetting("report_sent_for").catch(() => null)) === month) return false;
  const admins = (await getCoachRoster()).filter((r) => r.role === "admin").map((r) => r.email);
  // Marked first: a failure is logged, not retried every five minutes all day.
  await setSetting("report_sent_for", month);
  return sendMonthReport(month, admins);
}
