import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { getConversationsForCoach } from "@/lib/chat-db";
import { withTeamChat } from "@/lib/team-chat";
import { createAdminClient } from "@/lib/supabase/admin";

/** The team's inbox in the app: every customer conversation, newest first, with the team chat pinned (as /staff/messages). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const list = await withTeamChat(await getConversationsForCoach(), caller.user.id);
  // Same-day jobs still unanswered: tagged on their row.
  const { data: urgent } = await createAdminClient()
    .from("enquiries")
    .select("conversation_id")
    .eq("status", "new")
    .eq("same_day", true)
    .gte("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString())
    .not("conversation_id", "is", null);
  const sameDay = new Set((urgent ?? []).map((r) => r.conversation_id as string));
  // Unread: something from the customer the team hasn't read, even if an
  // automatic message ("we've got your request") has come in since.
  const unread = new Set<string>();
  await Promise.all(
    list.map(async (c) => {
      if (c.isTeam || !c.lastMessageAt || (c.coachLastReadAt && c.coachLastReadAt >= c.lastMessageAt)) return;
      if (!c.lastMessageFromCoach) return void unread.add(c.id);
      const { data } = await createAdminClient()
        .from("chat_messages")
        .select("created_at")
        .eq("conversation_id", c.id)
        .eq("sender_is_coach", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && (!c.coachLastReadAt || c.coachLastReadAt < (data.created_at as string))) unread.add(c.id);
    }),
  );
  return mobileJson({
    conversations: list.map((c) => ({
      id: c.id,
      name: c.displayName,
      avatarUrl: c.avatarUrl,
      guest: c.isGuest,
      isTeam: !!c.isTeam,
      preview: c.lastMessagePreview,
      fromUs: c.lastMessageFromCoach,
      lastMessageAt: c.lastMessageAt,
      unread: c.isTeam ? !!c.lastMessageAt && !c.lastMessageFromCoach && (!c.coachLastReadAt || c.coachLastReadAt < c.lastMessageAt) : unread.has(c.id),
      completed: !!c.completedAt,
      lastFrom: c.memberLastSource ?? null,
      sameDay: sameDay.has(c.id),
    })),
  });
}
