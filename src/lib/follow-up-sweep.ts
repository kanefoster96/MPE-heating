import { createAdminClient } from "@/lib/supabase/admin";
import { londonNow } from "@/lib/schedule-time";
import { addDays } from "@/lib/day-plan";
import { recordNotice, remindersDue, returnsToBook, type Appointment } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { openEnquiriesSince } from "@/lib/enquiries";
import { sendVisitNotice } from "@/lib/visit-notify";
import { sendEnquiryFollowUp } from "@/lib/enquiry-follow-up";
import { chatRecipientIds } from "@/lib/chat-routing";
import { checkPushReceipts, pushToUsers } from "@/lib/push";
import { sendUnpaidReminder } from "@/lib/payments";
import { REVIEW_REMIND_AFTER_DAYS, sendReviewAsk } from "@/lib/job-completion";
import { takeDueInstalments } from "@/lib/instalments";
import { dropUnpaidDeposit, sendQuoteFollowUp } from "@/lib/quotes";
import { sendCertificateRenewals } from "@/lib/job-files";
import { sendDueMonthReport } from "@/lib/monthly-report";

/**
 * Every automatic message to customers, and the team's nudges, in one pass.
 * Kanvas Academy's trial follow-up sweep, for MPE's visits and bookings:
 *
 * - the evening before a visit (from 6pm): a reminder, with their link;
 * - about an hour before the window: who's coming and when;
 * - the day after a "Not in" (from midday): sorry we missed you, pick
 *   another time;
 * - a booking form with no visit yet: a follow-up a day later, reminding
 *   them what they asked about with their link to pick a time, then one
 *   last check-in three days after that;
 * - a year after a service or install: their annual service is due;
 * - the team: a push when a new job or a customer's request has waited two
 *   hours unanswered;
 * - an invoice or call-out fee still unpaid: a reminder after 3 days and
 *   after 7, then the team's told it needs chasing;
 * - a finished job: "how did we do?" a couple of hours later, and one
 *   reminder three days on (lib/job-completion.ts);
 * - an invoice being paid monthly: on its date, that month's payment is
 *   taken from their saved card (lib/instalments.ts);
 * - a quote not yet answered: a nudge two days after it's sent, the last
 *   word four days after that, and it lapses the day after it runs out
 *   (lib/quotes.ts);
 * - a gas safety record running out within a month: book the next check
 *   (lib/job-files.ts);
 * - on the 1st: last month's numbers emailed to the admins
 *   (lib/monthly-report.ts).
 *
 * Run every five minutes (vercel.json). Every stage checks its own "sent"
 * column first and sets it after, so a re-run never sends twice, and each
 * keeps to daytime London hours so no one gets a text in the night.
 */

const HOUR_LEAD_EARLIEST = 70; // minutes before the window opens
const HOUR_LEAD_LATEST = 50;
const DAY_BEFORE_FROM = 18 * 60;
const DAY_BEFORE_UNTIL = 21 * 60;
const DAYTIME_FROM = 10 * 60;
const DAYTIME_UNTIL = 19 * 60;
const STAFF_FROM = 8 * 60;
const STAFF_UNTIL = 19 * 60;
const MISSED_FROM = 12 * 60;
const FOLLOW_UP_AFTER_HOURS = 24;
const LAST_FOLLOW_UP_AFTER_DAYS = 3;
/** A booking form older than this needs a conversation, not an automatic message. */
const FOLLOW_UP_WITHIN_DAYS = 14;
const STAFF_NUDGE_AFTER_HOURS = 2;
/** A same-day job (the boiler's gone today) can't wait two hours: the team hear after 15 minutes, 7am to 9pm. */
const SAME_DAY_NUDGE_AFTER_MINUTES = 15;
const SAME_DAY_FROM = 7 * 60;
const SAME_DAY_UNTIL = 21 * 60;
const SERVICE_DUE_AFTER_DAYS = 335;
const SERVICE_DUE_UNTIL_DAYS = 400;
const QUOTE_FIRST_FOLLOW_UP_DAYS = 2;
const QUOTE_LAST_FOLLOW_UP_DAYS = 4;
const UNPAID_FIRST_DAYS = 3;
const UNPAID_SECOND_DAYS = 7;
const UNPAID_TEAM_DAYS = 10;
/** Keeps one run comfortably inside a function's time limit; the rest go next run. */
const MAX_SENDS = 40;

export type SweepResult = {
  certificateRenewals: number;
  quoteFollowUps: number;
  monthlyPayments: number;
  reviewAsks: number;
  unpaidReminders: number;
  hourBefore: number;
  dayBefore: number;
  missed: number;
  followUps: number;
  serviceDue: number;
  staffNudged: number;
};

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

export async function runFollowUpSweep(): Promise<SweepResult> {
  const result: SweepResult = { certificateRenewals: 0, quoteFollowUps: 0, monthlyPayments: 0, reviewAsks: 0, unpaidReminders: 0, hourBefore: 0, dayBefore: 0, missed: 0, followUps: 0, serviceDue: 0, staffNudged: 0 };
  const { dateISO: today, minutes } = londonNow();
  const admin = createAdminClient();
  let budget = MAX_SENDS;
  const spend = () => budget-- > 0;

  // Each stage is caught on its own: one failing never stops the others.
  const stage = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      console.error(`follow-up sweep: ${name} failed`, err);
    }
  };

  // 1. About an hour before the window: who's coming and when.
  await stage("hour-before", async () => {
    const { data } = await admin
      .from("appointments")
      .select("id, start_minute, notified_at")
      .eq("day", today)
      .eq("status", "booked")
      .not("customer_id", "is", null)
      .is("hour_reminded_at", null)
      // Already told "we're on the way": a "with you between…" after it would only confuse.
      .is("on_my_way_at", null);
    for (const row of data ?? []) {
      const lead = (row.start_minute as number) - minutes;
      if (lead > HOUR_LEAD_EARLIEST || lead < HOUR_LEAD_LATEST) continue;
      // Booked in the last hour: they've only just been told.
      if (row.notified_at && hoursSince(row.notified_at as string) < 1) continue;
      if (!spend()) return;
      await sendVisitNotice(row.id as string, "hour", null);
      result.hourBefore++;
    }
  });

  // 2. The evening before: a reminder for tomorrow's visits.
  await stage("day-before", async () => {
    if (minutes < DAY_BEFORE_FROM || minutes >= DAY_BEFORE_UNTIL) return;
    for (const visit of await remindersDue(addDays(today, 1))) {
      // Booked this afternoon: the booking message is reminder enough.
      if (visit.notifiedAt && hoursSince(visit.notifiedAt) < 6) {
        await recordNotice(visit.id, "reminder", []);
        continue;
      }
      if (!spend()) return;
      await sendVisitNotice(visit.id, "reminder", null);
      result.dayBefore++;
    }
  });

  // 3. The day after a "Not in": sorry we missed you, pick another time.
  await stage("missed", async () => {
    if (minutes < MISSED_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("appointments")
      .select("id")
      .eq("status", "no_access")
      .lt("day", today)
      .gte("day", addDays(today, -7))
      .not("customer_id", "is", null)
      .is("missed_followup_at", null)
      .is("change_requested_at", null);
    for (const row of data ?? []) {
      if (!spend()) return;
      await sendVisitNotice(row.id as string, "missed", null);
      result.missed++;
    }
  });

  // 3b. A request whose day went by without us booking it: sorry, pick another day.
  await stage("past-requests", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("appointments")
      .select("id, customer_id, created_at")
      .eq("status", "requested")
      .lt("day", today)
      .gte("day", addDays(today, -7))
      .not("customer_id", "is", null)
      .is("past_request_sent_at", null);
    for (const row of data ?? []) {
      // Booked or seen since they asked (a visit added rather than the request accepted): nothing to say sorry for.
      const { count: since } = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", row.customer_id as string)
        .in("status", ["booked", "done", "no_access"])
        .gte("created_at", row.created_at as string);
      if (since) {
        await recordNotice(row.id as string, "past_request", []);
        continue;
      }
      if (!spend()) return;
      await sendVisitNotice(row.id as string, "past_request", null);
      result.missed++;
    }
  });

  // 4. Booking forms with no visit yet: remind them what they asked about.
  await stage("follow-ups", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    for (const e of await openEnquiriesSince(FOLLOW_UP_WITHIN_DAYS)) {
      if (!e.customerId || e.followupCount >= 2) continue;
      const due =
        e.followupCount === 0
          ? hoursSince(e.createdAt) >= FOLLOW_UP_AFTER_HOURS
          : !!e.followedUpAt && hoursSince(e.followedUpAt) >= LAST_FOLLOW_UP_AFTER_DAYS * 24;
      if (!due) continue;

      // Already booked, or asked for a time: nothing to chase.
      const { count: visits } = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", e.customerId)
        .neq("status", "cancelled")
        .gte("created_at", e.createdAt);
      if (visits) continue;
      // A person has written in their conversation since (the team or the
      // customer): it's a conversation now, not a follow-up.
      if (e.conversationId) {
        const after = new Date(new Date(e.createdAt).getTime() + 2 * 60_000).toISOString();
        const { count: talked } = await admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", e.conversationId)
          .not("sender_id", "is", null)
          .gt("created_at", after);
        if (talked) continue;
      }

      if (!spend()) return;
      const stageNo = (e.followupCount + 1) as 1 | 2;
      await sendEnquiryFollowUp(e, stageNo);
      await admin
        .from("enquiries")
        .update({ followup_count: stageNo, followed_up_at: new Date().toISOString() })
        .eq("id", e.id);
      result.followUps++;
    }
  });

  // 5. A year after a service or install: the annual service is due.
  await stage("service-due", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("appointments")
      .select("id, customer_id, day")
      .eq("status", "done")
      .in("kind", ["service", "install"])
      .lte("day", addDays(today, -SERVICE_DUE_AFTER_DAYS))
      .gte("day", addDays(today, -SERVICE_DUE_UNTIL_DAYS))
      .is("service_due_sent_at", null)
      .not("customer_id", "is", null);
    for (const row of data ?? []) {
      // Serviced, or booked in, since: they don't need telling.
      const { count: since } = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", row.customer_id as string)
        .eq("kind", "service")
        .in("status", ["requested", "booked", "done"])
        .gt("day", row.day as string);
      if (since) {
        await recordNotice(row.id as string, "service_due", []);
        continue;
      }
      if (!spend()) return;
      await sendVisitNotice(row.id as string, "service_due", null);
      result.serviceDue++;
    }
  });

  // 5b. The team: a same-day job no one's answered in 15 minutes.
  await stage("same-day", async () => {
    if (minutes < SAME_DAY_FROM || minutes >= SAME_DAY_UNTIL) return;
    const before = new Date(Date.now() - SAME_DAY_NUDGE_AFTER_MINUTES * 60_000).toISOString();
    const { data } = await admin
      .from("enquiries")
      .select("id, category, postcode, name, conversation_id")
      .eq("status", "new")
      .eq("same_day", true)
      .lte("created_at", before)
      // Since midnight in London (the clock's minutes into today).
      .gte("created_at", new Date(Date.now() - minutes * 60_000).toISOString())
      .is("staff_nudged_at", null);
    for (const row of data ?? []) {
      await pushToUsers(await chatRecipientIds(), {
        title: "Same-day job waiting",
        body: `${[row.name, row.postcode].filter(Boolean).join(", ") || "A customer"} needs someone today and hasn't had a reply yet.`,
        data: row.conversation_id ? { kind: "chat", conversationId: row.conversation_id as string } : { kind: "link", href: "/staff/messages?tab=jobs" },
      });
      await admin.from("enquiries").update({ staff_nudged_at: new Date().toISOString() }).eq("id", row.id as string);
      result.staffNudged++;
    }
  });

  // 5c. The team: a return visit still not booked a day after the first visit. Once.
  await stage("returns", async () => {
    if (minutes < STAFF_FROM || minutes >= STAFF_UNTIL) return;
    const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
    for (const v of await returnsToBook()) {
      if (!v.completedAt || v.completedAt > dayAgo) continue;
      // Its nudge as a request, if it had one, was before it was done.
      if (v.staffNudgedAt && v.staffNudgedAt > v.completedAt) continue;
      const who = v.customerId ? ((await getCustomer(v.customerId))?.name ?? "A customer") : "A customer";
      await pushToUsers(await chatRecipientIds(), {
        title: "Return visit to book",
        body: `${who}'s return visit${v.returnNote ? ` (to ${v.returnNote})` : ""} isn't booked yet. They were told we'd be in touch.`,
        data: { kind: "link", href: `/staff/jobs/${v.id}` },
      });
      await admin.from("appointments").update({ staff_nudged_at: new Date().toISOString() }).eq("id", v.id);
      result.staffNudged++;
    }
  });

  // 6. The team: new jobs and customers' requests waiting two hours.
  await stage("staff", async () => {
    if (minutes < STAFF_FROM || minutes >= STAFF_UNTIL) return;
    const before = new Date(Date.now() - STAFF_NUDGE_AFTER_HOURS * 3_600_000).toISOString();
    const [{ data: jobs }, { data: requests }] = await Promise.all([
      admin.from("enquiries").select("id").eq("status", "new").lte("created_at", before).is("staff_nudged_at", null),
      admin.from("appointments").select("id, enquiry_id").eq("status", "requested").lte("created_at", before).is("staff_nudged_at", null),
    ]);
    // A booking and its own request are one thing waiting, not two.
    const asked = new Set((requests ?? []).map((r) => r.enquiry_id as string | null).filter(Boolean));
    const jobIds = (jobs ?? []).map((r) => r.id as string).filter((id) => !asked.has(id));
    const requestIds = (requests ?? []).map((r) => r.id as string);
    if (!jobIds.length && !requestIds.length) return;

    const parts = [
      jobIds.length ? `${jobIds.length} new job${jobIds.length === 1 ? "" : "s"}` : null,
      requestIds.length ? `${requestIds.length} visit request${requestIds.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    await pushToUsers(await chatRecipientIds(), {
      title: "Waiting for a reply",
      body: `${parts.join(" and ")} ${jobIds.length + requestIds.length === 1 ? "has" : "have"} been waiting over two hours.`,
      data: { kind: "link", href: requestIds.length ? "/staff/schedule?waiting=1#waiting" : "/staff/messages?tab=jobs" },
    });
    const now = new Date().toISOString();
    if (jobIds.length) await admin.from("enquiries").update({ staff_nudged_at: now }).in("id", jobIds);
    if (requestIds.length) await admin.from("appointments").update({ staff_nudged_at: now }).in("id", requestIds);
    result.staffNudged += jobIds.length + requestIds.length;
  });

  // 6b. Monthly payments due today, from 10am (London), so a failed one can be sorted the same day.
  await stage("monthly", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    result.monthlyPayments = await takeDueInstalments(spend);
  });

  // 6c. Quotes: lapse the ones that ran out, then follow up open ones.
  await stage("quotes", async () => {
    const { data: lapsed } = await admin.from("quotes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("status", "sent").lt("valid_until", today).select("id");
    for (const q of lapsed ?? []) await dropUnpaidDeposit(q.id as string);
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("quotes")
      .select("id, sent_at, followup_count, followed_up_at")
      .eq("status", "sent")
      .lt("followup_count", 2)
      .lte("sent_at", new Date(Date.now() - QUOTE_FIRST_FOLLOW_UP_DAYS * 86_400_000).toISOString())
      .limit(50);
    for (const q of data ?? []) {
      const count = (q.followup_count as number) ?? 0;
      if (count === 1 && hoursSince((q.followed_up_at as string | null) ?? (q.sent_at as string)) < QUOTE_LAST_FOLLOW_UP_DAYS * 24) continue;
      if (!spend()) return;
      if (await sendQuoteFollowUp(q.id as string, count === 0 ? 1 : 2)) result.quoteFollowUps++;
      await admin.from("quotes").update({ followup_count: count + 1, followed_up_at: new Date().toISOString() }).eq("id", q.id as string);
    }
  });

  // 6d. Gas safety records running out within a month (landlords): book the next check.
  await stage("certificates", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    result.certificateRenewals = await sendCertificateRenewals(spend);
  });

  // 6e. The 1st, from 8am: last month's numbers to the admins.
  await stage("monthly-report", async () => {
    if (minutes < STAFF_FROM) return;
    await sendDueMonthReport(today);
  });

  // 6f. Once an hour: Expo's receipts for the app's pushes, dropping phones that have gone (lib/push.ts).
  await stage("push-receipts", async () => {
    if (minutes % 60 >= 5) return;
    await checkPushReceipts();
  });

  // 7. Unpaid: reminders at 3 and 7 days, then the team chases it.
  await stage("unpaid", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("payment_requests")
      .select("id, number, kind, amount_pence, reminder_count, created_at, reminded_at, customer_id")
      .eq("status", "open")
      // Being paid monthly: Stripe takes it, and chases a missed one itself.
      .is("plan_status", null)
      // A quote's deposit isn't a bill: the quote's own follow-ups cover it.
      .or("quote_id.is.null,kind.neq.other")
      .lt("reminder_count", 3)
      .lte("created_at", new Date(Date.now() - UNPAID_FIRST_DAYS * 86_400_000).toISOString());
    for (const row of data ?? []) {
      const count = (row.reminder_count as number) ?? 0;
      const age = hoursSince(row.created_at as string) / 24;
      const due = count === 0 ? age >= UNPAID_FIRST_DAYS : count === 1 ? age >= UNPAID_SECOND_DAYS : age >= UNPAID_TEAM_DAYS;
      if (!due) continue;
      if (count < 2) {
        if (!spend()) return;
        await sendUnpaidReminder(row.id as string);
        result.unpaidReminders++;
      } else {
        const who = row.customer_id ? (await getCustomer(row.customer_id as string))?.name : null;
        await pushToUsers(await chatRecipientIds(), {
          title: "Still unpaid",
          body: `${who ? `${who}: ` : ""}${row.kind === "callout_fee" ? "a call-out fee" : `MPE-${row.number}`} (£${((row.amount_pence as number) / 100).toFixed(2)}) is still unpaid after two reminders.`,
          data: { kind: "link", href: `/staff/invoices?invoice=${row.id}` },
        });
      }
      await admin
        .from("payment_requests")
        .update({ reminder_count: count + 1, reminded_at: new Date().toISOString() })
        .eq("id", row.id as string)
        .eq("status", "open");
    }
  });

  // 8. Finished jobs: how did we do? Then one reminder.
  await stage("reviews", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const nowIso = new Date().toISOString();
    const { data: due } = await admin
      .from("appointments")
      .select("id")
      .eq("status", "done")
      .not("customer_id", "is", null)
      .lte("review_due_at", nowIso)
      .is("review_asked_at", null)
      .limit(50);
    for (const row of due ?? []) {
      if (!spend()) return;
      if (await sendReviewAsk(row.id as string, 1)) result.reviewAsks++;
      await admin.from("appointments").update({ review_asked_at: new Date().toISOString() }).eq("id", row.id as string);
    }
    const { data: remind } = await admin
      .from("appointments")
      .select("id")
      .eq("status", "done")
      .lte("review_asked_at", new Date(Date.now() - REVIEW_REMIND_AFTER_DAYS * 86_400_000).toISOString())
      .is("review_reminded_at", null)
      .limit(50);
    for (const row of remind ?? []) {
      if (!spend()) return;
      if (await sendReviewAsk(row.id as string, 2)) result.reviewAsks++;
      await admin.from("appointments").update({ review_reminded_at: new Date().toISOString() }).eq("id", row.id as string);
    }
  });

  return result;
}

/** For the team's visit cards: the automatic messages this visit has had. */
export function remindersSent(a: Appointment): { label: string; at: string }[] {
  return [
    a.remindedAt ? { label: "Evening-before reminder", at: a.remindedAt } : null,
    a.hourRemindedAt ? { label: "Hour-before confirmation", at: a.hourRemindedAt } : null,
    a.onMyWayAt ? { label: "On my way", at: a.onMyWayAt } : null,
    a.missedFollowupAt ? { label: "Sorry we missed you", at: a.missedFollowupAt } : null,
    a.serviceDueSentAt ? { label: "Service due reminder", at: a.serviceDueSentAt } : null,
    a.reviewAskedAt ? { label: "Review ask", at: a.reviewAskedAt } : null,
    a.reviewRemindedAt ? { label: "Review reminder", at: a.reviewRemindedAt } : null,
  ].filter((x): x is { label: string; at: string } => !!x);
}

