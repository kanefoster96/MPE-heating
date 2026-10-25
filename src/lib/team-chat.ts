import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachRoster } from "@/lib/coach";
import { pushToUsers } from "@/lib/push";
import type { ConversationWithMember } from "@/lib/chat";
import { chatBodyToPlainText } from "@/lib/chat-links";
import { resolveDisplayName } from "@/lib/display-name";
import { CLUB, CLUB_SITE_URL } from "@/lib/club";

/**
 * "Kanvas Team": one staff-only group chat for every admin and coach,
 * pinned to the top of the coach inbox on the website and in the app.
 *
 * It's an ordinary chat_conversations row with is_team set and no owner
 * (user_id null), so the existing inbox, thread and send code all work on
 * it, the shipped app included. What makes it a group lives here: its name
 * and logo, each person's own read state (chat_team_reads, since the
 * shared coach_last_read_at would mark a teammate's post read for
 * everyone), and a push to everyone but the sender. Nothing about it ever
 * goes to a family: no email, no text, no AI suggestions.
 */

export const TEAM_CHAT_NAME = CLUB.teamName;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? CLUB_SITE_URL;
export const TEAM_CHAT_AVATAR_URL = `${siteUrl}/icons/icon-512.png`;

export async function isTeamConversation(conversationId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("chat_conversations").select("is_team").eq("id", conversationId).maybeSingle();
  return !!data?.is_team;
}

export async function markTeamRead(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("chat_team_reads")
    .upsert({ user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("team chat: mark read failed", error.message);
}

/**
 * The inbox as this viewer should see it: the team chat named, given the
 * logo, unread by their own read time, "You:" only for their own last
 * message, and first in the list. It's listed even before anyone has
 * posted, so it's there to start.
 */
export async function withTeamChat(list: ConversationWithMember[], viewerId: string): Promise<ConversationWithMember[]> {
  const admin = createAdminClient();
  const { data: team } = await admin.from("chat_conversations").select("*").eq("is_team", true).maybeSingle();
  if (!team) return list;

  const [{ data: last }, { data: read }] = await Promise.all([
    admin
      .from("chat_messages")
      .select("body, sender_id, attachment_type, created_at")
      .eq("conversation_id", team.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("chat_team_reads").select("last_read_at").eq("user_id", viewerId).maybeSingle(),
  ]);

  const existing = list.find((c) => c.id === team.id);
  // The latest post, with who wrote it when it wasn't you ("Talia: …").
  let preview = "Updates and questions for the coaching team";
  if (last) {
    const text =
      chatBodyToPlainText(last.body || "") ||
      (last.attachment_type === "image" ? "📷 Photo" : last.attachment_type === "video" ? "🎥 Video" : last.attachment_type ? "📎 File" : "");
    let who = "";
    if (last.sender_id && last.sender_id !== viewerId) {
      const { data: sender } = await admin.auth.admin.getUserById(last.sender_id);
      who = sender?.user ? `${resolveDisplayName(sender.user)}: ` : "";
    }
    preview = `${who}${text}`;
  }
  const unread = !!last && last.sender_id !== viewerId && (!read?.last_read_at || last.created_at > read.last_read_at);
  const lastMessageAt = existing?.lastMessageAt ?? team.last_message_at;
  const row: ConversationWithMember = {
    ...(existing ?? {
      id: team.id,
      userId: "",
      guestName: null,
      guestEmail: null,
      lastMessageAt: team.last_message_at,
      memberLastReadAt: null,
      coachLastReadAt: null,
      completedAt: null,
      completedBy: null,
      memberLastSource: null,
      memberLastActiveAt: null,
      memberNotifiedAt: null,
      visitorId: null,
      phone: null,
      completedByName: null,
      lastMessagePreview: "Updates and questions for the coaching team",
      lastMessageFromCoach: false,
    }),
    userId: "",
    displayName: TEAM_CHAT_NAME,
    isGuest: false,
    avatarUrl: TEAM_CHAT_AVATAR_URL,
    completedAt: null,
    completedByName: null,
    memberLastSource: null,
    // Inboxes treat "read" as coachLastReadAt ≥ lastMessageAt: give this
    // viewer their own.
    coachLastReadAt: unread ? null : lastMessageAt,
    lastMessagePreview: preview,
    lastMessageFromCoach: !!last && last.sender_id === viewerId,
    isTeam: true,
  };
  return [row, ...list.filter((c) => c.id !== team.id)];
}

/** A post in the team chat: a push to every admin and coach except whoever wrote it. */
export async function notifyTeam(params: { conversationId: string; senderId: string; senderName: string; body: string }): Promise<void> {
  try {
    const roster = await getCoachRoster();
    const recipients = roster.map((r) => r.id).filter((id) => id !== params.senderId);
    await pushToUsers(recipients, {
      title: TEAM_CHAT_NAME,
      body: `${params.senderName}: ${params.body || "Sent an attachment"}`,
      data: { kind: "chat", conversationId: params.conversationId },
      withBadge: true,
    });
  } catch (err) {
    console.error("team chat: push failed", err);
  }
}

export type TeamReadReceipt = { userId: string; name: string; avatarUrl: string | null; seenLatest: boolean; lastReadAt: string | null };

/**
 * Who has seen the latest Kanvas Team post: every admin and coach except
 * the viewer (and the demo account), with the last time they opened the
 * chat. Opening the thread is what counts; a push on its own doesn't.
 */
export async function teamReadReceipts(viewerId: string): Promise<TeamReadReceipt[]> {
  const admin = createAdminClient();
  const { data: team } = await admin.from("chat_conversations").select("id").eq("is_team", true).maybeSingle();
  if (!team) return [];
  const [roster, { data: reads }, { data: last }] = await Promise.all([
    getCoachRoster(),
    admin.from("chat_team_reads").select("user_id, last_read_at"),
    admin.from("chat_messages").select("created_at, sender_id").eq("conversation_id", team.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const readAt = new Map((reads ?? []).map((r) => [r.user_id as string, r.last_read_at as string]));
  const people = roster.filter((r) => r.id !== viewerId && !r.email.toLowerCase().startsWith("demo."));
  const receipts: TeamReadReceipt[] = [];
  for (const p of people) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    const at = readAt.get(p.id) ?? null;
    receipts.push({
      userId: p.id,
      name: data?.user ? resolveDisplayName(data.user) : p.email,
      avatarUrl: (data?.user?.user_metadata?.avatar_url as string | undefined) ?? null,
      // Whoever wrote the latest post has obviously seen it.
      seenLatest: !!last && (last.sender_id === p.id || (!!at && at >= last.created_at)),
      lastReadAt: at,
    });
  }
  return receipts.sort((a, b) => Number(b.seenLatest) - Number(a.seenLatest) || a.name.localeCompare(b.name));
}
