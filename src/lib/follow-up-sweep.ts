import { createAdminClient } from "@/lib/supabase/admin";
import { londonInstant, londonNow } from "@/lib/schedule-time";
import { addDays } from "@/lib/day-plan";
import { pricesToSend, recordNotice, remindersDue, returnsToBook, type Appointment } from "@/lib/appointments";
import { getSetting, setSetting } from "@/lib/settings";
import { getCustomer } from "@/lib/customers";
import { syncTwilioTotal, usageAlerts } from "@/lib/twilio-usage";
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
import { clockWord, teamHours, teamHoursOpen } from "@/lib/team-hours";
import { formatPhone } from "@/lib/phone";

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
 * keeps to daytime London hours so no one's woken in the night.
 */

const HOUR_LEAD_EARLIEST = 70; // minutes before the window opens
const HOUR_LEAD_LATEST = 50;
const DAY_BEFORE_FROM = 18 * 60;
const DAY_BEFORE_UNTIL = 21 * 60;
const DAYTIME_FROM = 10 * 60;
const DAYTIME_UNTIL = 19 * 60;
const STAFF_FROM = 8 * 60;
/** The team's reminder of prices to send and return visits to book: 9am and 1pm (London). */
const WAITING_REMINDERS = [9 * 60, 13 * 60];
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

/** Who each conversation's with, for the team's pushes: their customer name, the name they gave, or their number. Null for the team chat. */
async function conversationNames(ids: string[]): Promise<(string | null)[]> {
  const admin = createAdminClient();
  const [{ data: convos }, { data: customers }] = await Promise.all([
    admin.from("chat_conversations").select("id, guest_name, phone, is_team").in("id", ids),
    admin.from("customers").select("conversation_id, name").in("conversation_id", ids),
  ]);
  const byId = new Map((convos ?? []).map((c) => [c.id as string, c]));
  const customerName = new Map((customers ?? []).map((c) => [c.conversation_id as string, c.name as string | null]));
  return ids.map((id) => {
    const c = byId.get(id);
    if (!c || c.is_team) return null;
    return customerName.get(id)?.trim() || (c.guest_name as string | null)?.trim() || (c.phone ? formatPhone(c.phone as string) : "A website visitor");
  });
}

/** "Sam, Jo and 2 more". */
function listNames(names: string[]): string {
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : (shown[0] ?? "");
}

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
      .is("on_my_way_at", null)
      // Or they've said they won't be in.
      .is("cant_make_at", null);
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

  // 5c. The team: what's waiting on them after a call-out (a price to send,
  // a return visit to book), at 9am and again at 1pm, in case a busy
  // morning pushed it out of mind. One push each time, for everything.
  await stage("waiting", async () => {
    const slot = WAITING_REMINDERS.filter((m) => minutes >= m).pop();
    if (slot === undefined || minutes >= STAFF_UNTIL) return;
    const key = `${today} ${slot}`;
    if ((await getSetting("waiting_reminder_for")) === key) return;
    // Marked first: a slow push mustn't mean a second one five minutes later.
    if (!(await setSetting("waiting_reminder_for", key))) return;
    const [prices, returns] = await Promise.all([pricesToSend(), returnsToBook()]);
    if (!prices.length && !returns.length) return;
    const names = async (visits: Appointment[]) => {
      const list = await Promise.all(visits.slice(0, 3).map(async (v) => (v.customerId ? ((await getCustomer(v.customerId))?.name?.split(" ")[0] ?? null) : null)));
      const known = list.filter((n): n is string => !!n);
      return known.length ? ` (${known.join(", ")}${visits.length > known.length ? " and more" : ""})` : "";
    };
    const parts = [
      prices.length ? `${prices.length} price${prices.length === 1 ? "" : "s"} to send${await names(prices)}` : null,
      returns.length ? `${returns.length} return visit${returns.length === 1 ? "" : "s"} to book${await names(returns)}` : null,
    ].filter(Boolean);
    await pushToUsers(await chatRecipientIds(), {
      title: "Waiting on you",
      body: `${parts.join(" and ")}. Once the part's priced or in, it's a couple of taps from the Jobs tab.`,
      data: { kind: "link", href: "/staff/jobs" },
    });
    result.staffNudged += prices.length + returns.length;
  });

  // 6. The team: new jobs and customers' requests waiting two hours.
  // 5e. The team: what came in while we were closed (nobody's notified then), in one push once we open.
  await stage("overnight", async () => {
    // Only first thing after opening: a sweep that first runs late in the day (a deploy, say) doesn't send it at teatime.
    const hours = await teamHours();
    if (minutes < hours.from || minutes >= hours.from + 120) return;
    if ((await getSetting("overnight_summary_for")) === today) return;
    // Marked first: a slow push mustn't mean a second one five minutes later.
    if (!(await setSetting("overnight_summary_for", today))) return;
    // Closing yesterday to opening today, London time (right across the nights the clocks change).
    const since = londonInstant(addDays(today, -1), hours.until).toISOString();
    const until = londonInstant(today, hours.from).toISOString();
    const { data: rows } = await admin.from("chat_messages").select("conversation_id").eq("sender_is_coach", false).gte("created_at", since).lt("created_at", until);
    const found = [...new Set((rows ?? []).map((r) => r.conversation_id as string))];
    if (!found.length) return;
    // Customers' conversations only (not the team chat), each with its name.
    const named = (await conversationNames(found)).map((name, i) => ({ id: found[i], name })).filter((c): c is { id: string; name: string } => c.name !== null);
    if (!named.length) return;
    const names = named.map((c) => c.name);
    await pushToUsers(await chatRecipientIds(), {
      title: "Overnight",
      body: `${names.length} new message${names.length === 1 ? "" : "s"} since ${clockWord(hours.until)}: ${listNames(names)}.`,
      data: named.length === 1 ? { kind: "chat", conversationId: named[0].id } : { kind: "link", href: "/staff/messages" },
    });
    result.staffNudged += names.length;
  });

  // 5f. The team: a customer's message with no reply for two hours (counted from opening for
  // one that came in overnight). Once each. A new booking's chased by the stage below instead.
  await stage("chats", async () => {
    const hours = await teamHours();
    if (minutes < hours.from || minutes >= hours.until) return;
    // Counted from opening for one that came in out of hours.
    const eight = Date.now() - (minutes - hours.from) * 60_000;
    const due = Date.now() - 2 * 3_600_000;
    const { data: convos } = await admin
      .from("chat_conversations")
      .select("id, staff_nudged_at")
      .eq("is_team", false)
      .is("completed_at", null)
      .gte("last_message_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
      // Anything since (a reply, or theirs) is under two hours old: nothing to chase yet.
      .lte("last_message_at", new Date(due).toISOString())
      .limit(200);
    const waiting: string[] = [];
    for (const c of convos ?? []) {
      // The last message a person wrote (automatic ones have no sender): theirs, not ours.
      const { data: last } = await admin.from("chat_messages").select("sender_is_coach, created_at").eq("conversation_id", c.id as string).not("sender_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!last || last.sender_is_coach) continue;
      const at = new Date(last.created_at as string).getTime();
      if (Math.max(at, eight) > due) continue;
      if (c.staff_nudged_at && new Date(c.staff_nudged_at as string).getTime() >= at) continue;
      waiting.push(c.id as string);
    }
    if (!waiting.length) return;
    const { data: booking } = await admin.from("enquiries").select("conversation_id").in("conversation_id", waiting).eq("status", "new");
    const chased = new Set((booking ?? []).map((e) => e.conversation_id as string));
    const ids = waiting.filter((id) => !chased.has(id));
    if (!ids.length) return;
    const names = (await conversationNames(ids)).map((n) => n ?? "A customer");
    await pushToUsers(await chatRecipientIds(), {
      title: "Waiting for a reply",
      body: `${listNames(names)} ${ids.length === 1 ? "has" : "have"} been waiting over two hours for a reply in the chat.`,
      data: ids.length === 1 ? { kind: "chat", conversationId: ids[0] } : { kind: "link", href: "/staff/messages" },
    });
    await admin.from("chat_conversations").update({ staff_nudged_at: new Date().toISOString() }).in("id", ids);
    result.staffNudged += ids.length;
  });

  // 5d. The month's calls and texts: Twilio's own total (every half hour), and a heads-up at each £5 of the £30.
  await stage("usage", async () => {
    await syncTwilioTotal();
    // Not out of hours: a £5 step passed overnight is told once we open.
    if (await teamHoursOpen()) await usageAlerts();
  });

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
      .select("id, number, kind, amount_pence, reminder_count, created_at, reminded_at, customer_id, created_by, appointment_id")
      .eq("status", "open")
      // Being paid monthly: Stripe takes it, and chases a missed one itself.
      .is("plan_status", null)
      // A quote's deposit isn't a bill: the quote's own follow-ups cover it.
      .or("quote_id.is.null,kind.neq.other")
      .lt("reminder_count", 3)
      .lte("created_at", new Date(Date.now() - UNPAID_FIRST_DAYS * 86_400_000).toISOString());
    // A call-out fee they started paying ahead and left (lib/callout-prepay.ts) is optional until
    // the visit: not chased while it's still to come. After it, it's a bill like any other.
    const prepaidVisits = [...new Set((data ?? []).filter((r) => r.kind === "callout_fee" && !r.created_by && r.appointment_id).map((r) => r.appointment_id as string))];
    const { data: ahead } = prepaidVisits.length ? await admin.from("appointments").select("id").in("id", prepaidVisits).eq("status", "booked").gte("day", today) : { data: [] };
    const notYet = new Set((ahead ?? []).map((a) => a.id as string));
    for (const row of data ?? []) {
      if (row.kind === "callout_fee" && !row.created_by && notYet.has(row.appointment_id as string)) continue;
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

