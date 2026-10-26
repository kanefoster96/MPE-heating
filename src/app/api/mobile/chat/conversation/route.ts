import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { getConversationForCoachById, getMessagesForApp, getOrCreateConversation, isGuestUser } from "@/lib/chat-db";
import { ensureWelcome } from "@/lib/chat-welcome";
import { resolveDisplayName } from "@/lib/display-name";
import { TEAM_CHAT_NAME, teamReadReceipts } from "@/lib/team-chat";
import { ENQUIRY_STEPS, enquiryCards } from "@/lib/app-chat";
import { customerIdForConversation } from "@/lib/app-customer";

/**
 * A chat for the app. A customer gets their own (made on first open, with
 * the welcome message, like the website's /messages). The team pass
 * `conversationId` for any customer's. `after` (an ISO time) returns only
 * newer messages: the app polls with it alongside Realtime.
 */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const params = new URL(request.url).searchParams;
  const after = params.get("after");
  const requested = params.get("conversationId");

  if (caller.staff && requested) {
    const conversation = await getConversationForCoachById(requested);
    if (!conversation) return mobileJson({ error: "That conversation has gone." }, 404);
    let title = TEAM_CHAT_NAME;
    let guest = false;
    if (!conversation.isTeam) {
      const { data } = await createAdminClient().auth.admin.getUserById(conversation.userId);
      guest = isGuestUser(data?.user);
      title = guest ? conversation.guestName || "Guest" : resolveDisplayName(data?.user, "Customer");
    }
    // Who they are, for the name at the top: their customer page, if they're one yet.
    const customerId = conversation.isTeam || after ? null : await customerIdForConversation(conversation.id);
    // Their bookings with where each is up to; for the team chat, who's seen what.
    const [enquiries, receipts] = await Promise.all([
      conversation.isTeam || after ? Promise.resolve([]) : enquiryCards(conversation.id),
      conversation.isTeam ? teamReadReceipts(caller.user.id).catch(() => []) : Promise.resolve([]),
    ]);
    return mobileJson({
      conversation: {
        id: conversation.id,
        title,
        phone: conversation.phone,
        completed: !!conversation.completedAt,
        isTeam: !!conversation.isTeam,
        customerId,
        guest,
        lastFrom: conversation.memberLastSource,
      },
      messages: await getMessagesForApp(conversation.id, after),
      viewer: { id: caller.user.id, staff: true },
      enquiries,
      enquirySteps: ENQUIRY_STEPS,
      receipts: receipts.map((r) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, lastReadAt: r.lastReadAt })),
    });
  }

  const conversation = await getOrCreateConversation(caller.user.id);
  if (!conversation) return mobileJson({ error: "Chat is temporarily unavailable. Please try again shortly." }, 503);
  if (!after) await ensureWelcome(conversation.id);
  return mobileJson({
    conversation: { id: conversation.id, title: "The MPE team", phone: null, completed: false, isTeam: false },
    messages: await getMessagesForApp(conversation.id, after),
    viewer: { id: caller.user.id, staff: caller.staff },
  });
}
