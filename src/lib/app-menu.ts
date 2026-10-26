import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonNow } from "@/lib/schedule-time";
import { addDays } from "@/lib/day-plan";
import { bookedPerDay, businessSnapshot, takenByMonth } from "@/lib/dashboard";
import { returnsToBook, waitingOnTeamCount } from "@/lib/appointments";
import { getNewEnquiryCount, getUnreadCountForCoach } from "@/lib/chat-db";
import { formatPence } from "@/lib/payments";
import { monthName, monthNumbers, previousMonth } from "@/lib/monthly-report";
import { staffIdentity } from "@/lib/staff-identity";

/**
 * Fergal's Menu in the app (mobile/app/(tabs)/menu.tsx): Kanvas Academy's
 * admin menu, as cards that turn orange when something needs him and
 * green when it's all in order. Built from the same numbers as the
 * website's /staff home (lib/dashboard.ts). Money is for admins only, as
 * on the website: an engineer sees the jobs, requests and messages.
 */

export type MenuTone = "alert" | "good" | "plain";
export type MenuCard = {
  id: string;
  icon: string;
  title: string;
  value: string;
  caption: string;
  tone: MenuTone;
  /** How many things need him here: the count on the Menu's row. 0 when nothing does. */
  count: number;
  /** A screen in the app, or a website page opened signed in. */
  route?: string;
  path?: string;
};

export async function staffOverview(user: User, admin: boolean): Promise<{ name: string; attention: number; cards: MenuCard[] }> {
  const today = londonNow().dateISO;
  const soon = addDays(today, 30);
  const [identity, strip, waiting, enquiries, unread, certificates, returns] = await Promise.all([
    staffIdentity(user).catch(() => ({ name: "", avatarUrl: null })),
    bookedPerDay(today, 1).catch(() => [{ day: today, count: 0, minutes: 0 }]),
    waitingOnTeamCount(today).catch(() => 0),
    getNewEnquiryCount().catch(() => 0),
    getUnreadCountForCoach(user.id).catch(() => 0),
    createAdminClient()
      .from("job_files")
      .select("id", { count: "exact", head: true })
      .eq("kind", "certificate")
      .gte("expires_on", today)
      .lte("expires_on", soon)
      .then((r) => r.count ?? 0, () => 0),
    returnsToBook().then((r) => r.length, () => 0),
  ]);
  const jobsToday = strip[0]?.count ?? 0;
  // A booking with its own request (its "when suits you") counts once.
  const overlap = await (async () => {
    const admin = createAdminClient();
    const { data: asked } = await admin.from("appointments").select("enquiry_id").eq("status", "requested").gte("day", addDays(today, -7)).not("enquiry_id", "is", null);
    const ids = (asked ?? []).map((r) => r.enquiry_id as string);
    if (!ids.length) return 0;
    const { count } = await admin.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new").in("id", ids);
    return count ?? 0;
  })().catch(() => 0);
  const newBookings = Math.max(0, enquiries - overlap);
  const requests = waiting + newBookings + returns;

  const cards: MenuCard[] = [
    { id: "today", icon: "clipboard", title: "Today's jobs", value: String(jobsToday), caption: jobsToday ? "Booked today" : "Nothing booked today", tone: "plain", count: 0, route: "/jobs" },
    {
      id: "requests",
      icon: "time",
      title: "Requests",
      value: String(requests),
      caption: requests
        ? [newBookings ? `${newBookings} new booking${newBookings === 1 ? "" : "s"}` : "", waiting ? `${waiting} to book in` : "", returns ? `${returns} return visit${returns === 1 ? "" : "s"} to book` : ""].filter(Boolean).join(", ")
        : "All answered",
      tone: requests ? "alert" : "good",
      count: requests,
      route: "/notifications",
    },
    { id: "messages", icon: "chatbubbles", title: "Messages", value: String(unread), caption: unread ? "Unread" : "All read", tone: unread ? "alert" : "good", count: unread, route: "/chat" },
    {
      id: "certificates",
      icon: "shield-checkmark",
      title: "Certificates",
      value: String(certificates),
      caption: certificates ? "Run out within 30 days" : "None running out soon",
      tone: certificates ? "alert" : "good",
      count: certificates,
      route: "/certificates",
    },
  ];

  if (admin) {
    const s = await businessSnapshot(today);
    const up = s.takenThisMonthPence - s.takenLastMonthPence;
    cards.push(
      {
        id: "invoices",
        icon: "receipt",
        title: "Invoices",
        value: s.unpaidCount ? formatPence(s.owedPence) : "£0",
        caption: s.overdueCount ? `${s.overdueCount} overdue, over a week` : s.unpaidCount ? `${s.unpaidCount} waiting to be paid` : "All paid",
        tone: s.overdueCount ? "alert" : s.unpaidCount ? "plain" : "good",
        count: s.overdueCount,
        route: "/invoices",
      },
      {
        id: "monthly",
        icon: "calendar-number",
        title: "Monthly payments",
        value: String(s.monthlyFailedCount),
        caption: s.monthlyFailedCount ? `Failed: card needs updating` : "None failed",
        tone: s.monthlyFailedCount ? "alert" : "good",
        count: s.monthlyFailedCount,
        route: "/invoices?show=monthly",
      },
      {
        id: "plan",
        icon: "refresh-circle",
        title: "Maintenance plan",
        value: String(s.plan.members),
        caption: s.plan.failed
          ? `${s.plan.failed} payment${s.plan.failed === 1 ? "" : "s"} failed`
          : s.plan.leaving
            ? `${s.plan.leaving} leaving`
            : s.plan.members
              ? `${formatPence(s.plan.monthlyPence)} a month`
              : "No members yet",
        tone: s.plan.failed ? "alert" : s.plan.members ? "good" : "plain",
        count: s.plan.failed,
        route: "/plan",
      },
      {
        id: "quotes",
        icon: "document-text",
        title: "Quotes",
        value: String(s.quotes.open),
        caption: s.quotes.accepted ? `${s.quotes.accepted} accepted, to book in` : s.quotes.open ? `${formatPence(s.quotes.openPence)} out with customers` : "None out",
        tone: s.quotes.accepted ? "alert" : "plain",
        count: s.quotes.accepted,
        route: "/quotes",
      },
      {
        id: "money",
        icon: "cash",
        title: "This month",
        value: formatPence(s.takenThisMonthPence),
        caption: s.takenLastMonthPence ? `${up >= 0 ? "Up" : "Down"} ${formatPence(Math.abs(up))} on last month` : "Taken so far",
        tone: "plain",
        count: 0,
        route: "/finance",
      },
      {
        id: "reviews",
        icon: "star",
        title: "Reviews",
        value: s.reviews.average ? `${s.reviews.average.toFixed(1)}★` : "–",
        caption: s.reviews.count ? `${s.reviews.count} in 90 days, ${s.reviews.toGoogle} to Google` : "None in 90 days",
        tone: s.reviews.average && s.reviews.average >= 4.5 ? "good" : "plain",
        count: 0,
        route: "/metrics",
      },
    );
  }

  return { name: identity.name, attention: cards.filter((c) => c.tone === "alert").length, cards };
}

/** The app's Finance screen: six months taken, what's owed, and the plan's regular income. */
export async function staffFinance() {
  const today = londonNow().dateISO;
  const [months, s] = await Promise.all([takenByMonth(today, 6), businessSnapshot(today)]);
  return {
    months: months.map((m) => ({ ...m, label: monthName(m.month).split(" ")[0].slice(0, 3), taken: formatPence(m.takenPence) })),
    thisMonth: formatPence(s.takenThisMonthPence),
    lastMonth: formatPence(s.takenLastMonthPence),
    owed: formatPence(s.owedPence),
    unpaid: s.unpaidCount,
    overdue: s.overdueCount,
    planMonthly: formatPence(s.plan.monthlyPence),
    planMembers: s.plan.members,
    quotesOut: formatPence(s.quotes.openPence),
    quotesOpen: s.quotes.open,
  };
}

/** The app's Metrics screen: a month in numbers (lib/monthly-report.ts), against the month before. */
export async function staffMetrics(monthParam: string | null) {
  const current = londonNow().dateISO.slice(0, 7);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam <= current ? monthParam : current;
  const [now, before] = await Promise.all([monthNumbers(month), monthNumbers(previousMonth(month))]);
  return { month, label: monthName(month), previous: previousMonth(month), previousLabel: monthName(previousMonth(month)), now, before };
}

/**
 * Certificates running out in the next 60 days, soonest first, for the
 * app's Certificates screen. Their customers are reminded automatically
 * (lib/job-files.ts); this is so the team can see who's coming up.
 */
export async function certificatesDue(): Promise<{ id: string; title: string; expiresOn: string; customerId: string | null; customer: string | null }[]> {
  const today = londonNow().dateISO;
  const admin = createAdminClient();
  const { data } = await admin
    .from("job_files")
    .select("id, title, cert_type, expires_on, customer_id")
    .eq("kind", "certificate")
    .gte("expires_on", today)
    .lte("expires_on", addDays(today, 60))
    .order("expires_on")
    .limit(100);
  const rows = (data ?? []) as { id: string; title: string | null; cert_type: string | null; expires_on: string; customer_id: string | null }[];
  const ids = [...new Set(rows.map((r) => r.customer_id).filter((id): id is string => !!id))];
  const { data: customers } = ids.length ? await admin.from("customers").select("id, name").in("id", ids) : { data: [] };
  const names = new Map(((customers ?? []) as { id: string; name: string | null }[]).map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title || (r.cert_type ? r.cert_type.toUpperCase() : "Certificate"),
    expiresOn: r.expires_on,
    customerId: r.customer_id,
    customer: r.customer_id ? (names.get(r.customer_id) ?? null) : null,
  }));
}
