import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDisplayName } from "@/lib/display-name";
import { staffIdentity } from "@/lib/staff-identity";
import { chatBodyToPlainText } from "@/lib/chat-links";
import type { ChatMessage, Conversation, ConversationWithMember } from "@/lib/chat";

/**
 * A "guest" for chat display purposes: either a real anonymous web visitor
 * (is_anonymous, via signInAnonymously) or a phone-only identity created by
 * getOrCreateConversationByPhone below (sms_guest metadata) — neither has an
 * email to show, so both fall back to guest_name/"Guest" the same way.
 */
export function isGuestUser(
  user: { is_anonymous?: boolean | null; user_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  // email_guest: a contact MPE made for an email-only booking (lib/enquiries.ts).
  return !!user?.is_anonymous || !!user?.user_metadata?.sms_guest || !!user?.user_metadata?.email_guest;
}

type ConversationRow = {
  id: string;
  user_id: string;
  guest_name: string | null;
  guest_email: string | null;
  last_message_at: string;
  member_last_read_at: string | null;
  coach_last_read_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  member_last_source: "web" | "app" | null;
  member_last_active_at: string | null;
  member_notified_at: string | null;
  visitor_id: string | null;
  phone: string | null;
  is_team?: boolean;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_is_coach: boolean;
  body: string;
  channel: "chat" | "email" | "sms";
  attachment_path: string | null;
  attachment_type: "image" | "video" | "file" | null;
  attachment_name: string | null;
  payment_request_id?: string | null;
  created_at: string;
};

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email ?? null,
    lastMessageAt: row.last_message_at,
    memberLastReadAt: row.member_last_read_at,
    coachLastReadAt: row.coach_last_read_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    memberLastSource: row.member_last_source ?? null,
    memberLastActiveAt: row.member_last_active_at ?? null,
    memberNotifiedAt: row.member_notified_at ?? null,
    visitorId: row.visitor_id,
    phone: row.phone,
    isTeam: !!row.is_team,
  };
}

/**
 * The address a coach's reply can be emailed to — a real member's auth
 * email, or whatever a web guest chose to leave. Null means "can't be
 * emailed" (an anonymous guest who skipped it, or a phone-only identity).
 */
export async function getConversationMemberEmail(
  conversation: Pick<Conversation, "userId" | "guestEmail">,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(conversation.userId);
    if (data?.user && !isGuestUser(data.user) && data.user.email) return data.user.email;
    return conversation.guestEmail?.trim() || null;
  } catch {
    return conversation.guestEmail?.trim() || null;
  }
}

/** Reverse lookup for the Resend inbound webhook — the reply_token baked into a notification email's Reply-To address. */
export async function getConversationByReplyToken(token: string): Promise<Conversation | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chat_conversations")
      .select("*")
      .eq("reply_token", token)
      .maybeSingle();
    return data ? mapConversation(data) : null;
  } catch {
    return null;
  }
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderIsCoach: row.sender_is_coach,
    body: row.body,
    channel: row.channel,
    attachmentPath: row.attachment_path,
    attachmentType: row.attachment_type,
    attachmentName: row.attachment_name,
    paymentRequestId: row.payment_request_id ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Fetches the caller's conversation with the Academy, creating it on first
 * use (guestName only matters for that first creation). Returns null —
 * never throws — if the chat tables aren't migrated yet or any other DB
 * error occurs, since this runs on every page load via the root layout;
 * callers must treat null as "chat temporarily unavailable".
 *
 * visitorId (the analytics_events.visitor_id cookie, see lib/analytics.ts)
 * is stamped onto the conversation once and never overwritten — it's
 * "however we first recognized this person," not their latest browser. A
 * caller with no visitor id yet (declined cookies, or hasn't loaded a page
 * with the tracker on it) simply leaves the existing value alone.
 */
export async function getOrCreateConversation(
  userId: string,
  guestName?: string,
  visitorId?: string | null,
): Promise<Conversation | null> {
  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("chat_conversations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (!existing.visitor_id && visitorId) {
        const { data: updated } = await admin
          .from("chat_conversations")
          .update({ visitor_id: visitorId })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updated) return mapConversation(updated);
      }
      return mapConversation(existing);
    }

    const { data: created, error } = await admin
      .from("chat_conversations")
      .insert({ user_id: userId, guest_name: guestName ?? null, visitor_id: visitorId ?? null })
      .select("*")
      .single();

    // Two requests opening the chat at once (the app's first load, say):
    // the other one made it a moment ago, so use that.
    if (error?.code === "23505") {
      const { data: raced } = await admin.from("chat_conversations").select("*").eq("user_id", userId).maybeSingle();
      return raced ? mapConversation(raced) : null;
    }
    if (error || !created) return null;
    return mapConversation(created);
  } catch {
    return null;
  }
}

/**
 * Same idea as getOrCreateConversation, keyed by phone number instead of a
 * Supabase user id — for SMS-originated contact with no account at all: an
 * automated trial reminder text (src/lib/trial-followup-sweep.ts), a coach
 * texting a number by hand, or an inbound text from an unrecognized number
 * (the Twilio webhook). There's no browser session to call
 * supabase.auth.signInAnonymously() from in any of those cases, so this
 * creates a phone-identified auth.users row directly via the admin API
 * instead — Supabase's documented path for a phone-only identity, marked
 * pre-confirmed since Twilio itself is the verification (either we sent to
 * it, or they just texted from it).
 */
export async function getOrCreateConversationByPhone(
  phone: string,
  guestNameHint?: string | null,
): Promise<Conversation | null> {
  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("chat_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    // Who the number belongs to — a member's family or a trial booking — so
    // the conversation carries their name instead of "Guest". Only worked
    // out while it still has no name: once named, a coach's own edit stands.
    // (Loaded here, not at the top: coach-calls reaches back into this file.)
    const known =
      !existing?.guest_name && !guestNameHint
        ? await (await import("@/lib/coach-calls")).identifyPhone(admin, phone)
        : null;
    const name = guestNameHint ?? known?.name ?? null;

    if (existing) {
      if (!existing.guest_name && name) {
        const { data: updated } = await admin
          .from("chat_conversations")
          .update({ guest_name: name, ...(known?.email && !existing.guest_email ? { guest_email: known.email } : {}) })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updated) return mapConversation(updated);
      }
      return mapConversation(existing);
    }

    const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { sms_guest: true },
    });
    if (createUserError || !userData.user) return null;

    const { data: created, error } = await admin
      .from("chat_conversations")
      .insert({ user_id: userData.user.id, guest_name: name, guest_email: known?.email ?? null, phone })
      .select("*")
      .single();

    if (error || !created) return null;
    return mapConversation(created);
  } catch {
    return null;
  }
}

/**
 * Read-only lookup — unlike getOrCreateConversation, never inserts a row.
 * Used anywhere a conversation might not exist yet and that's fine (e.g. the
 * root layout checking whether to show a badge), so a member browsing the
 * site before ever opening chat doesn't leave a message-less conversation
 * sitting in the coach inbox.
 */
export async function getConversationForUser(userId: string): Promise<Conversation | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chat_conversations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return data ? mapConversation(data) : null;
  } catch {
    return null;
  }
}

/**
 * Admin-client fetch by id for a caller already confirmed to be a coach
 * (server actions, the mobile API, MCP tools) — bypasses RLS, so it must
 * never be reached from a member path. Returns the full row including the
 * notification bookkeeping columns sendCoachMessage needs.
 */
export async function getConversationForCoachById(id: string): Promise<Conversation | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("chat_conversations").select("*").eq("id", id).maybeSingle();
    return data ? mapConversation(data) : null;
  } catch {
    return null;
  }
}

export async function getConversationById(
  id: string,
): Promise<Conversation | undefined> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return data ? mapConversation(data) : undefined;
  } catch {
    return undefined;
  }
}

export type VisitorConversationLink = {
  conversationId: string;
  userId: string;
  isGuest: boolean;
  displayName: string;
};

/**
 * Reverse lookup of the visitor_id stamp getOrCreateConversation sets — lets
 * the analytics visitor page offer "Open chat"/"View account" links. Only
 * returns something if this visitor actually has a conversation; a
 * browsing-only visitor who's never opened chat has no account/chat
 * identity to jump to, which is expected, not an error.
 */
export async function getConversationByVisitorId(
  visitorId: string,
): Promise<VisitorConversationLink | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chat_conversations")
      .select("id, user_id, guest_name")
      .eq("visitor_id", visitorId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const { data: userData } = await admin.auth.admin.getUserById(data.user_id);
    const isGuest = !!userData?.user?.is_anonymous;
    const displayName = isGuest
      ? data.guest_name || "Guest"
      : userData?.user
        ? resolveDisplayName(userData.user)
        : "Unknown member";

    return { conversationId: data.id, userId: data.user_id, isGuest, displayName };
  } catch {
    return null;
  }
}

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Attaches a display name + photo to every coach-sent message, so a member
 * can see who actually replied right on the bubble instead of a generic
 * "Kanvas Team" header. Batched by unique sender id to avoid one admin
 * lookup per message in a long thread.
 */
async function attachSenderInfo(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const coachSenderIds = [
    ...new Set(messages.filter((m) => m.senderIsCoach && m.senderId).map((m) => m.senderId as string)),
  ];
  if (coachSenderIds.length === 0) return messages;

  const admin = createAdminClient();
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();

  // The name and photo an admin chose for them, else their own (lib/staff-identity.ts).
  await Promise.all(
    coachSenderIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (!data?.user) return;
      const identity = await staffIdentity(data.user, admin, { cached: true });
      nameById.set(id, identity.name);
      avatarById.set(id, identity.avatarUrl);
    }),
  );

  return messages.map((m) =>
    m.senderIsCoach
      ? {
          ...m,
          senderName: m.senderId ? (nameById.get(m.senderId) ?? null) : null,
          senderAvatarUrl: m.senderId ? (avatarById.get(m.senderId) ?? null) : null,
        }
      : m,
  );
}

async function resolveAttachmentUrls(
  messages: ChatMessage[],
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ChatMessage[]> {
  const paths = messages.map((m) => m.attachmentPath).filter((p): p is string => !!p);
  if (paths.length === 0) return messages;

  const { data: signed } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const urlByPath = new Map<string, string>();
  for (const entry of signed ?? []) {
    if (entry.signedUrl && entry.path) urlByPath.set(entry.path, entry.signedUrl);
  }

  return messages.map((m) => ({
    ...m,
    attachmentUrl: m.attachmentPath ? (urlByPath.get(m.attachmentPath) ?? null) : null,
  }));
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  try {
    const supabase = await createClient();
    // The newest thousand, oldest first (no limit stopped at the oldest 1000).
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1000);

    const messages = (data ?? []).reverse().map(mapMessage);
    const withUrls = await resolveAttachmentUrls(messages, supabase);
    return attachSenderInfo(withUrls);
  } catch {
    return [];
  }
}

/**
 * Same shape as getConversationMessages, for a caller with no cookie
 * session to read RLS against — the MCP connector's coach tools
 * (src/lib/mcp/tools/messaging.ts), authenticated by bearer token instead.
 * The admin client bypasses RLS for both the message select and the
 * attachment signed-url lookup (service-role storage access ignores bucket
 * RLS the same way it ignores table RLS), so this is safe to call for any
 * conversation once the caller is already confirmed to be a coach.
 */
export async function getConversationMessagesAsCoach(
  conversationId: string,
): Promise<ChatMessage[]> {
  try {
    const admin = createAdminClient();
    // The newest thousand, oldest first (no limit stopped at the oldest 1000).
    const { data } = await admin
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1000);

    const messages = (data ?? []).reverse().map(mapMessage);
    const withUrls = await resolveAttachmentUrls(messages, admin);
    return attachSenderInfo(withUrls);
  } catch {
    return [];
  }
}

/**
 * Messages sent after a given timestamp — the polling fallback ChatThread
 * uses alongside its Realtime subscription, so new replies still show up
 * on their own even if a Realtime event is ever missed or misconfigured.
 */
export async function getMessagesSince(
  conversationId: string,
  afterIso: string,
): Promise<ChatMessage[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .gt("created_at", afterIso)
      .order("created_at", { ascending: true });

    const messages = (data ?? []).map(mapMessage);
    const withUrls = await resolveAttachmentUrls(messages, supabase);
    return attachSenderInfo(withUrls);
  } catch {
    return [];
  }
}

/**
 * Resolves a signed URL for a single attachment on demand — used for
 * messages that arrive over Realtime after the initial page load, since
 * the realtime payload only carries the raw row (just attachment_path),
 * not a pre-signed URL. RLS on the storage bucket does the authorization
 * check, so this simply fails (returns null) for anyone not in that
 * conversation.
 */
export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Coach inbox — every conversation with at least one message, newest
 * activity first, names resolved. A conversation with zero messages (e.g.
 * a visitor who opened the chat window but never typed) is deliberately
 * excluded — only actual sent messages should surface here.
 */
export async function getConversationsForCoach(): Promise<ConversationWithMember[]> {
  try {
    const admin = createAdminClient();

    const conversations = await fetchAll<ConversationRow>((from, to) =>
      admin.from("chat_conversations").select("*").order("last_message_at", { ascending: false }).order("id").range(from, to),
    );

    // The staff group chat isn't a family's conversation; the inboxes add it
    // back themselves, pinned (lib/team-chat.ts).
    const allRows = conversations.filter((r) => !r.is_team);
    if (allRows.length === 0) return [];

    // Each conversation's latest message, from chat_latest_messages (one
    // row per conversation, supabase/schema.sql). A club database without
    // it yet reads the messages newest first a page at a time instead,
    // stopping once every conversation has one: one plain read would stop
    // at Supabase's 1000 rows and drop the quieter conversations, and an
    // .in() of every id would outgrow the request URL.
    type Latest = { conversation_id: string; body: string | null; sender_is_coach: boolean; attachment_type: string | null };
    const wanted = new Set(allRows.map((r) => r.id));
    let latest: Latest[] = [];
    let rpcFailed = false;
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await admin.rpc("chat_latest_messages").order("conversation_id").range(from, from + 999);
      if (error) {
        rpcFailed = true;
        break;
      }
      latest.push(...((page ?? []) as Latest[]));
      if (!page || page.length < 1000) break;
    }
    if (rpcFailed) {
      latest = [];
      const found = new Set<string>();
      for (let from = 0; found.size < wanted.size; from += 1000) {
        const { data: page, error } = await admin
          .from("chat_messages")
          .select("conversation_id, body, sender_is_coach, attachment_type")
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        for (const msg of page ?? []) {
          if (wanted.has(msg.conversation_id) && !found.has(msg.conversation_id)) {
            found.add(msg.conversation_id);
            latest.push(msg as Latest);
          }
        }
        if (!page || page.length < 1000) break;
      }
    }

    const previewByConversation = new Map<string, string>();
    const lastFromCoachByConversation = new Map<string, boolean>();
    for (const msg of latest) {
      if (!wanted.has(msg.conversation_id)) continue;
      // An attachment-only message would otherwise preview as nothing.
      const fallback =
        msg.attachment_type === "image" ? "📷 Photo" : msg.attachment_type === "video" ? "🎥 Video" : msg.attachment_type ? "📎 File" : "";
      previewByConversation.set(msg.conversation_id, chatBodyToPlainText(msg.body || "") || fallback);
      lastFromCoachByConversation.set(msg.conversation_id, !!msg.sender_is_coach);
    }

    const rows = allRows.filter((r) => previewByConversation.has(r.id));
    if (rows.length === 0) return [];

    const relevantUserIds = [
      ...new Set([
        ...rows.map((r) => r.user_id),
        ...rows
          .map((r) => r.completed_by)
          .filter((id): id is string => !!id),
      ]),
    ];

    const nameByUserId: Record<string, string> = {};
    const avatarByUserId: Record<string, string | null> = {};
    const anonymousUserIds = new Set<string>();
    // Ten at a time rather than one after another: an inbox of fifty
    // families was fifty lookups in a row on every open.
    for (let i = 0; i < relevantUserIds.length; i += 10) {
      const batch = relevantUserIds.slice(i, i + 10);
      const users = await Promise.all(batch.map((uid) => admin.auth.admin.getUserById(uid).then((r) => r.data?.user ?? null)));
      batch.forEach((uid, j) => {
        const u = users[j];
        if (u) {
          nameByUserId[uid] = resolveDisplayName(u);
          avatarByUserId[uid] = (u.user_metadata?.avatar_url as string | undefined) ?? null;
        }
        if (isGuestUser(u ?? undefined)) anonymousUserIds.add(uid);
      });
    }

    return rows.map((row) => {
      const isGuest = anonymousUserIds.has(row.user_id);
      const displayName = isGuest
        ? row.guest_name || "Guest"
        : (nameByUserId[row.user_id] ?? "Unknown member");

      return {
        ...mapConversation(row),
        displayName,
        isGuest,
        avatarUrl: isGuest ? null : (avatarByUserId[row.user_id] ?? null),
        completedByName: row.completed_by ? (nameByUserId[row.completed_by] ?? null) : null,
        lastMessagePreview: previewByConversation.get(row.id) ?? "",
        lastMessageFromCoach: lastFromCoachByConversation.get(row.id) ?? false,
      };
    });
  } catch (err) {
    console.error("getConversationsForCoach failed", err);
    return [];
  }
}

/**
 * Conversation ids with at least one message matching the search text —
 * used to let a coach search full chat history, not just the latest
 * preview line shown in the inbox.
 */
export async function findConversationIdsMatchingText(query: string): Promise<Set<string>> {
  const trimmed = query.trim();
  if (!trimmed) return new Set();

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chat_messages")
      .select("conversation_id")
      .ilike("body", `%${trimmed}%`);

    return new Set((data ?? []).map((row) => row.conversation_id));
  } catch {
    return new Set();
  }
}

/** Unread count for a visitor/member — coach messages sent after their last read time. */
export async function getUnreadCountForUser(userId: string): Promise<number> {
  try {
    const conversation = await getConversationForUser(userId);
    if (!conversation) return 0;

    const supabase = await createClient();
    let query = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_is_coach", true);

    if (conversation.memberLastReadAt) {
      query = query.gt("created_at", conversation.memberLastReadAt);
    }

    const { count } = await query;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Total unread count across all conversations, for the coach chat badge.
 * With the viewer's id it also counts Kanvas Team posts from other staff
 * since they last read it (team read state is per person).
 */
export async function getUnreadCountForCoach(viewerId?: string): Promise<number> {
  try {
    const admin = createAdminClient();

    const conversations = await fetchAll<{ id: string; coach_last_read_at: string | null; is_team: boolean | null }>((from, to) =>
      admin.from("chat_conversations").select("id, coach_last_read_at, is_team").order("id").range(from, to),
    );

    let teamUnread = 0;
    const team = (conversations ?? []).find((c) => c.is_team);
    if (team && viewerId) {
      const { data: read } = await admin.from("chat_team_reads").select("last_read_at").eq("user_id", viewerId).maybeSingle();
      let q = admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", team.id)
        .neq("sender_id", viewerId);
      if (read?.last_read_at) q = q.gt("created_at", read.last_read_at);
      const { count } = await q;
      teamUnread = count ?? 0;
    }

    const rows = (conversations ?? []).filter((c) => !c.is_team);
    if (rows.length === 0) return teamUnread;

    const memberMessages = await fetchAll<{ conversation_id: string; created_at: string }>((from, to) =>
      admin.from("chat_messages").select("conversation_id, created_at").eq("sender_is_coach", false).order("id").range(from, to),
    );

    const readAtByConversation = new Map(rows.map((r) => [r.id, r.coach_last_read_at]));

    return (
      teamUnread +
      (memberMessages ?? []).filter((msg) => {
        if (!readAtByConversation.has(msg.conversation_id)) return false;
        const readAt = readAtByConversation.get(msg.conversation_id);
        return !readAt || msg.created_at > readAt;
      }).length
    );
  } catch {
    return 0;
  }
}

/** New booking enquiries nobody has picked up yet — folded into the staff chat badge with unread messages, so a new job can't go unnoticed (MPE's take on Kanvas Academy's pending-requests count). */
export async function getNewEnquiryCount(): Promise<number> {
  try {
    const { count } = await createAdminClient()
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    return count ?? 0;
  } catch {
    return 0;
  }
}
