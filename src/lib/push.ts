import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachRoster } from "@/lib/coach";
import { CLUB } from "@/lib/club";

/**
 * Sends app push notifications through Expo's push service — no
 * server-side APNs/FCM handling here, Expo relays to Apple/Google using
 * the credentials on the EAS project. Tokens come from the app registering
 * via /api/mobile/push-token (see public.push_tokens). Everything is
 * best-effort and never throws: a push failing must never surface as the
 * message that triggered it having failed.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_BATCH_SIZE = 100;

/** Deep-link data the app reads on tap — see mobile/lib/push.ts. */
export type PushData =
  | { kind: "chat"; conversationId: string }
  | { kind: "register"; classId: string }
  | { kind: "student_home" }
  | { kind: "class_pass" }
  // Staff alerts (lib/staff-alerts.ts). The app doesn't route these yet —
  // pushData() in mobile/lib/push.ts returns null for a kind it doesn't
  // know, which costs the tap its destination but still shows the
  // notification. So these work from the day the server ships, and an app
  // update later only improves where tapping lands.
  | { kind: "staff_trial"; trialBookingId: string }
  | { kind: "staff_membership"; membershipId: string }
  | { kind: "staff_order"; orderId: string }
  | { kind: "staff_report" }
  // A dancer's profile (registered, an age exception to accept).
  | { kind: "staff_student"; studentId: string }
  // Anything else: opens the notifications list, where the alert's own
  // link takes them on. Never "staff_report", which opens reported content.
  | { kind: "staff_alert" }
  | { kind: "staff_waitlist" }
  | { kind: "staff_walk_in"; month: string }
  | { kind: "staff_accident"; reportId: string }
  | { kind: "staff_wages"; month: string }
  // Countdowns to an event: a family's opens the event (tickets, kit),
  // a coach's opens the event's admin page.
  | { kind: "event"; eventId: string }
  | { kind: "staff_event"; eventId: string }
  // An announcement (lib/send-notification.ts): opens the page it was sent
  // with, a website path the app maps to its own screen
  // (mobile/lib/notification-links.ts), or the notifications list when
  // there's none. An app before it knows this kind just opens.
  | { kind: "link"; href: string | null }
  // A free-trial family (lib/trial-push.ts): the join screen, carrying the
  // booking so it can start from the right child and class; or a missed
  // trial's "pick another date" page. An app older than 1.1.0 doesn't know
  // either kind, so the notification still shows and the tap just opens
  // the app.
  | { kind: "trial_join"; trialBookingId: string }
  | { kind: "trial_rebook"; trialCode: string };

type PushMessage = {
  title: string;
  body: string;
  data: PushData;
  /** Android notification channel — the app creates "chat" and "classes" at sign-in (mobile/lib/push.ts). */
  channelId?: "chat" | "classes";
  /** The number to set on the app's home-screen icon (iOS). Left out, the icon's number is unchanged. */
  badge?: number;
};

type ExpoTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

/** A registered phone and whose it is, so each push can be logged against the person. */
type Device = { token: string; userId: string | null };

async function tokensForUsers(userIds: string[]): Promise<Device[]> {
  if (userIds.length === 0) return [];
  const admin = createAdminClient();
  const devices: Device[] = [];
  // A hundred people at a time: hundreds of ids in one .in() outgrow the
  // request URL, the read fails and nobody gets the push (an announcement
  // to every contact did exactly that).
  for (let i = 0; i < userIds.length; i += 100) {
    const { data, error } = await admin.from("push_tokens").select("token, user_id").in("user_id", userIds.slice(i, i + 100));
    if (error) console.error("push: could not read devices", error);
    for (const row of data ?? []) devices.push({ token: row.token as string, userId: (row.user_id as string | null) ?? null });
  }
  return devices;
}

/**
 * One row per push in push_log, with Expo's answer, so a missed
 * notification can be traced to "never sent", "refused by Expo" or
 * "accepted" (then it's the phone's settings). Rows go after 30 days.
 * Best-effort like everything here.
 */
async function logPushes(rows: { device: Device; message: PushMessage; status: "ok" | "error" | "failed"; error?: string | null; ticketId?: string | null }[]) {
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("push_log").insert(
      rows.map((r) => ({
        user_id: r.device.userId,
        device: r.device.token ? r.device.token.replace(/\]$/, "").slice(-6) : null,
        kind: r.message.data.kind,
        title: r.message.title.slice(0, 120),
        status: r.status,
        error: r.error ?? null,
        ticket_id: r.ticketId ?? null,
      })),
    );
    if (Math.random() < 0.02) {
      await admin.from("push_log").delete().lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    }
  } catch (err) {
    console.error("push: could not log", err);
  }
}

/**
 * Expo's second answer. The ticket at send time only says Expo accepted the
 * push; whether Apple or Google then delivered it comes later as a receipt.
 * An app deleted from an iPhone usually only shows up here, as
 * DeviceNotRegistered, so without reading receipts those tokens stayed
 * forever: the family counted as "has the app" and lost the texts that
 * stand in for a push. Run hourly (api/cron/push-receipts): reads receipts
 * for pushes sent 15 minutes to a day ago, records each on its push_log
 * row, and deletes the tokens that died.
 */
export async function checkPushReceipts(): Promise<{ checked: number; removed: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const { data: rows, error } = await admin
    .from("push_log")
    .select("id, user_id, device, ticket_id")
    .eq("status", "ok")
    .not("ticket_id", "is", null)
    .is("receipt", null)
    .lt("created_at", new Date(now - 15 * 60 * 1000).toISOString())
    .gt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  if (error) throw error;
  if (!rows?.length) return { checked: 0, removed: 0 };

  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: rows.map((r) => r.ticket_id) }),
  });
  if (!res.ok) throw new Error(`Expo receipts returned ${res.status}`);
  const { data: receipts } = (await res.json()) as { data?: Record<string, ExpoTicket> };

  let removed = 0;
  for (const row of rows) {
    const receipt = receipts?.[row.ticket_id as string];
    // Not ready yet (Expo keeps them a day): looked at again next hour.
    if (!receipt) continue;
    const outcome = receipt.status === "ok" ? "ok" : (receipt.details?.error ?? receipt.message ?? "error");
    await admin.from("push_log").update({ receipt: outcome }).eq("id", row.id);
    if (receipt.details?.error === "DeviceNotRegistered" && row.user_id && row.device) {
      // The log keeps only the token's last characters; with the account
      // as well that names one phone.
      const { count } = await admin
        .from("push_tokens")
        .delete({ count: "exact" })
        .eq("user_id", row.user_id)
        .like("token", `%${row.device}]`);
      removed += count ?? 0;
    }
  }
  return { checked: rows.length, removed };
}

/** Whether this account has any device registered for pushes right now. */
export async function hasPushDevice(userId: string): Promise<boolean> {
  try {
    return (await tokensForUsers([userId])).length > 0;
  } catch {
    return false;
  }
}

async function sendToTokens(devices: Device[], message: PushMessage): Promise<void> {
  if (devices.length === 0) return;

  const dead: string[] = [];
  const log: Parameters<typeof logPushes>[0] = [];

  for (let i = 0; i < devices.length; i += EXPO_BATCH_SIZE) {
    const batch = devices.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(
          batch.map((device) => ({
            to: device.token,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: "default",
            channelId: message.channelId ?? "chat",
            ...(message.badge !== undefined ? { badge: message.badge } : {}),
          })),
        ),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`push: Expo returned ${res.status}`, text);
        for (const device of batch) log.push({ device, message, status: "failed", error: `Expo ${res.status}: ${text.slice(0, 200)}` });
        continue;
      }
      const { data: tickets } = (await res.json()) as { data?: (ExpoTicket & { id?: string })[] };
      batch.forEach((device, index) => {
        const ticket = tickets?.[index];
        // The one error worth acting on: the app was uninstalled or the
        // token otherwise died. Anything else (rate limit, transient) just
        // means this notification was missed.
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          dead.push(device.token);
        }
        log.push({
          device,
          message,
          status: ticket?.status === "ok" ? "ok" : "error",
          error: ticket?.status === "ok" ? null : (ticket?.details?.error ?? ticket?.message ?? "No ticket from Expo"),
          ticketId: ticket?.id ?? null,
        });
      });
    } catch (err) {
      console.error("push: request to Expo failed", err);
      for (const device of batch) log.push({ device, message, status: "failed", error: err instanceof Error ? err.message : "Request failed" });
    }
  }

  await logPushes(log);

  if (dead.length > 0) {
    const admin = createAdminClient();
    await admin.from("push_tokens").delete().in("token", dead);
  }
}

/**
 * One push per person, each carrying that person's own icon number
 * (lib/app-badge.ts) — for the important things only: messages, and
 * requests waiting on a decision.
 */
async function sendWithBadges(userIds: string[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const byUser = new Map<string, Device[]>();
  for (const device of await tokensForUsers(ids)) {
    if (device.userId) byUser.set(device.userId, [...(byUser.get(device.userId) ?? []), device]);
  }
  // Someone this should have reached but who has no phone signed in to the
  // app (or turned notifications off): logged, so it's visible why.
  await logPushes(
    ids
      .filter((id) => !byUser.has(id))
      .map((id) => ({ device: { token: "", userId: id }, message, status: "error" as const, error: "No phone registered" })),
  );
  const { badgeCountFor } = await import("@/lib/app-badge");
  await Promise.all(
    [...byUser.entries()].map(async ([userId, tokens]) => sendToTokens(tokens, { ...message, badge: await badgeCountFor(userId) })),
  );
}

/** A push to these accounts' devices — for callers that pick their own recipients. `withBadge` sets the icon number. */
export async function pushToUsers(userIds: string[], message: PushMessage & { withBadge?: boolean }): Promise<void> {
  try {
    const { withBadge, ...rest } = message;
    const msg = { ...rest, body: preview(rest.body) };
    if (withBadge) await sendWithBadges(userIds, msg);
    else await sendToTokens(await tokensForUsers([...new Set(userIds)]), msg);
  } catch (err) {
    console.error("pushToUsers failed", err);
  }
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 137)}…` : oneLine || "Sent an attachment";
}

/**
 * A parent/guest wrote in (website chat, app chat, or an inbound text) —
 * every coach's devices get a push. Emailed replies deliberately don't
 * come through here: those are forwarded to the inbox instead (see the
 * Resend webhook), by request.
 */
export async function pushCoachesNewMessage(params: {
  conversationId: string;
  fromName: string;
  body: string;
  /** Who to buzz (lib/chat-routing.ts). Without it, every coach and admin. */
  recipientIds?: string[];
}): Promise<void> {
  try {
    const recipients = params.recipientIds ?? (await getCoachRoster()).map((r) => r.id);
    await sendWithBadges(
      recipients,
      { title: params.fromName, body: preview(params.body), data: { kind: "chat", conversationId: params.conversationId } },
    );
  } catch (err) {
    console.error("pushCoachesNewMessage failed", err);
  }
}

/**
 * A coach replied to someone who last wrote from the app — their devices
 * get a push. (A website contact who's left is emailed instead; see
 * lib/chat-notify.ts. Someone with the thread open right now still gets
 * the push — the OS suppresses it if the app is foregrounded, and the
 * app's own handler decides what to show.)
 */
export async function pushMemberCoachReply(params: {
  conversationId: string;
  memberUserId: string;
  coachName: string;
  body: string;
}): Promise<void> {
  try {
    await sendWithBadges([params.memberUserId], {
      title: `${params.coachName} · ${CLUB.name}`,
      body: preview(params.body),
      data: { kind: "chat", conversationId: params.conversationId },
    });
  } catch (err) {
    console.error("pushMemberCoachReply failed", err);
  }
}

/**
 * A staff alert — something happened in the business that Kane or a coach
 * wants to hear about now (lib/staff-alerts.ts decides what and to whom).
 *
 * Sent on the "classes" channel rather than a channel of its own. Android
 * silently drops a notification whose channel the app hasn't created, and
 * the app creates exactly two: "chat" and "classes". Inventing a "staff"
 * channel here would mean these never appearing on Android until everyone
 * had updated the app. "classes" is the wrong label for a shop order, so
 * the app update that adds deep-linking should add the channel too — but
 * a slightly mislabelled notification that arrives beats a correctly
 * labelled one that doesn't.
 */
export async function pushStaffAlert(params: {
  userIds: string[];
  title: string;
  body: string;
  data: PushData;
  /** A request waiting on a decision: sets the icon number. Plain alerts (a new member, an order) leave it alone. */
  withBadge?: boolean;
}): Promise<void> {
  try {
    if (params.userIds.length === 0) return;
    const message = { title: params.title, body: preview(params.body), data: params.data, channelId: "classes" as const };
    if (params.withBadge) {
      await sendWithBadges(params.userIds, message);
      return;
    }
    const tokens = await tokensForUsers([...new Set(params.userIds)]);
    await sendToTokens(tokens, message);
  } catch (err) {
    console.error("pushStaffAlert failed", err);
  }
}

