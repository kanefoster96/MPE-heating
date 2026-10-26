import { NextResponse } from "next/server";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { customerForUser } from "@/lib/customers";
import { staffIdentity } from "@/lib/staff-identity";
import { getUnreadCountForCoach, getUnreadCountForUser } from "@/lib/chat-db";
import { noticesFor } from "@/lib/app-notifications";

/**
 * Who's signed in to the app, for its top bar: their name and picture (the
 * avatar), whether they're on the team (which changes Chat and the bell),
 * and the two counts: unread chat, and notifications waiting on them.
 */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { user, staff, admin } = caller;
  const guest = !!user.is_anonymous;

  const [profile, unreadChats, notices] = await Promise.all([
    staff
      ? staffIdentity(user).then((s) => ({ name: s.name, avatarUrl: s.avatarUrl }))
      : guest
        ? Promise.resolve({ name: null, avatarUrl: null })
        : customerForUser(user.id, user.email).then((c) => ({ name: c?.name ?? null, avatarUrl: null })),
    (staff ? getUnreadCountForCoach(user.id) : getUnreadCountForUser(user.id)).catch(() => 0),
    noticesFor(user, staff).catch(() => []),
  ]);

  return mobileJson({
    user: { id: user.id, email: guest ? null : (user.email ?? null), name: profile.name, avatarUrl: profile.avatarUrl, guest },
    staff,
    admin,
    unreadChats,
    waiting: notices.filter((n) => n.action).length,
  });
}
