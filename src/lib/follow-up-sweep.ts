import { createAdminClient } from "@/lib/supabase/admin";
import { londonNow } from "@/lib/schedule-time";
import { addDays } from "@/lib/day-plan";
import { recordNotice, remindersDue, type Appointment } from "@/lib/appointments";
import { openEnquiriesSince } from "@/lib/enquiries";
import { sendVisitNotice } from "@/lib/visit-notify";
import { sendEnquiryFollowUp } from "@/lib/enquiry-follow-up";
import { chatRecipientIds } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";
import { sendUnpaidReminder } from "@/lib/payments";

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
 *   after 7, then the team's told it needs chasing.
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
const SERVICE_DUE_AFTER_DAYS = 335;
const SERVICE_DUE_UNTIL_DAYS = 400;
const UNPAID_FIRST_DAYS = 3;
const UNPAID_SECOND_DAYS = 7;
const UNPAID_TEAM_DAYS = 10;
/** Keeps one run comfortably inside a function's time limit; the rest go next run. */
const MAX_SENDS = 40;

export type SweepResult = {
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
  const result: SweepResult = { unpaidReminders: 0, hourBefore: 0, dayBefore: 0, missed: 0, followUps: 0, serviceDue: 0, staffNudged: 0 };
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
      .is("hour_reminded_at", null);
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

  // 6. The team: new jobs and customers' requests waiting two hours.
  await stage("staff", async () => {
    if (minutes < STAFF_FROM || minutes >= STAFF_UNTIL) return;
    const before = new Date(Date.now() - STAFF_NUDGE_AFTER_HOURS * 3_600_000).toISOString();
    const [{ data: jobs }, { data: requests }] = await Promise.all([
      admin.from("enquiries").select("id").eq("status", "new").lte("created_at", before).is("staff_nudged_at", null),
      admin.from("appointments").select("id").eq("status", "requested").lte("created_at", before).is("staff_nudged_at", null),
    ]);
    const jobIds = (jobs ?? []).map((r) => r.id as string);
    const requestIds = (requests ?? []).map((r) => r.id as string);
    if (!jobIds.length && !requestIds.length) return;

    const parts = [
      jobIds.length ? `${jobIds.length} new job${jobIds.length === 1 ? "" : "s"}` : null,
      requestIds.length ? `${requestIds.length} visit request${requestIds.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    await pushToUsers(await chatRecipientIds(), {
      title: "Waiting for a reply",
      body: `${parts.join(" and ")} ${jobIds.length + requestIds.length === 1 ? "has" : "have"} been waiting over two hours.`,
      data: { kind: "link", href: requestIds.length ? "/staff/schedule" : "/staff/messages?tab=jobs" },
    });
    const now = new Date().toISOString();
    if (jobIds.length) await admin.from("enquiries").update({ staff_nudged_at: now }).in("id", jobIds);
    if (requestIds.length) await admin.from("appointments").update({ staff_nudged_at: now }).in("id", requestIds);
    result.staffNudged = jobIds.length + requestIds.length;
  });

  // 7. Unpaid: reminders at 3 and 7 days, then the team chases it.
  await stage("unpaid", async () => {
    if (minutes < DAYTIME_FROM || minutes >= DAYTIME_UNTIL) return;
    const { data } = await admin
      .from("payment_requests")
      .select("id, number, kind, amount_pence, reminder_count, created_at, reminded_at")
      .eq("status", "open")
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
        await pushToUsers(await chatRecipientIds(), {
          title: "Still unpaid",
          body: `${row.kind === "callout_fee" ? "A call-out fee" : `MPE-${row.number}`} (£${((row.amount_pence as number) / 100).toFixed(2)}) is still unpaid after two reminders.`,
          data: { kind: "link", href: "/staff/schedule" },
        });
      }
      await admin
        .from("payment_requests")
        .update({ reminder_count: count + 1, reminded_at: new Date().toISOString() })
        .eq("id", row.id as string)
        .eq("status", "open");
    }
  });

  return result;
}

/** For the team's visit cards: the automatic messages this visit has had. */
export function remindersSent(a: Appointment): { label: string; at: string }[] {
  return [
    a.remindedAt ? { label: "Evening-before reminder", at: a.remindedAt } : null,
    a.hourRemindedAt ? { label: "On-our-way message", at: a.hourRemindedAt } : null,
    a.missedFollowupAt ? { label: "Sorry we missed you", at: a.missedFollowupAt } : null,
    a.serviceDueSentAt ? { label: "Service due reminder", at: a.serviceDueSentAt } : null,
  ].filter((x): x is { label: string; at: string } => !!x);
}

