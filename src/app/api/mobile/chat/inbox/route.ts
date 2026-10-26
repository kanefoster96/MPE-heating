import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { getConversationsForCoach } from "@/lib/chat-db";
import { withTeamChat } from "@/lib/team-chat";

/** The team's inbox in the app: every customer conversation, newest first, with the team chat pinned (as /staff/messages). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const list = await withTeamChat(await getConversationsForCoach(), caller.user.id);
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
      unread: !!c.lastMessageAt && !c.lastMessageFromCoach && (!c.coachLastReadAt || c.coachLastReadAt < c.lastMessageAt),
      completed: !!c.completedAt,
      lastFrom: c.memberLastSource ?? null,
    })),
  });
}
