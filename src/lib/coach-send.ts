import type { User } from "@supabase/supabase-js";
import { staffIdentity } from "@/lib/staff-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConversationForCoachById, getConversationMemberEmail } from "@/lib/chat-db";
import { resolveDisplayName } from "@/lib/display-name";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { contactMessageEmailHtml } from "@/lib/emails/contact-message";
import { notifyMemberOfReply } from "@/lib/chat-notify";
import { hasPushDevice, pushMemberCoachReply } from "@/lib/push";
import type { SendMessageInput } from "@/lib/chat";
import { chatBodyToPlainText } from "@/lib/chat-links";
import { markTeamRead, notifyTeam } from "@/lib/team-chat";
import { CLUB } from "@/lib/club";

export type CoachSendResult =
  | { success: true }
  | { success: false; error: string; status: 400 | 403 | 404 | 500 };

/**
 * A coach's message into a conversation — the one implementation behind
 * the website's sendCoachMessage action and the app's /api/mobile/chat/send.
 * The caller has already checked the sender is a coach.
 *
 * Any coach can reply to any conversation — live presence in the thread is
 * what stops two people answering at once, not a lock. The message is
 * always saved in-app; "email" delivers a copy on top of that, so every
 * channel lands in one unified thread. No texts: see below.
 */
export async function deliverCoachMessage({
  user,
  conversationId,
  input,
}: {
  user: User;
  conversationId: string;
  input: SendMessageInput;
}): Promise<CoachSendResult> {
  const trimmed = input.body.trim();
  if (!trimmed && !input.attachmentPath) {
    return { success: false, error: "Message can't be empty.", status: 400 };
  }

  const admin = createAdminClient();
  const channel = input.channel ?? "chat";

  // Snapshot before the insert: the reply notification below needs to know
  // how the member last got in touch and whether they're in the chat right
  // now, as of before this message.
  const existingConversation = await getConversationForCoachById(conversationId);
  if (!existingConversation) return { success: false, error: "Conversation not found.", status: 404 };

  // The staff group chat: saved in-app and pushed to the team, nothing else.
  if (existingConversation.isTeam) {
    if (channel !== "chat") return { success: false, error: "The team chat is in-app only.", status: 400 };
    const { error: teamError } = await admin.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_is_coach: true,
      body: trimmed,
      channel: "chat",
      attachment_path: input.attachmentPath ?? null,
      attachment_type: input.attachmentType ?? null,
      attachment_name: input.attachmentName ?? null,
    });
    if (teamError) return { success: false, error: "Could not send your message.", status: 500 };
    await admin.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
    await markTeamRead(user.id);
    await notifyTeam({ conversationId, senderId: user.id, senderName: resolveDisplayName(user), body: chatBodyToPlainText(trimmed) });
    return { success: true };
  }

  // Fail before writing anything if the chosen channel can't be reached.
  let recipientEmail: string | null = null;
  // The only text MPE sends is the automatic one after a call (lib/missed-calls.ts):
  // someone who's only phoned or texted gets a reply from WhatsApp Business instead.
  if (channel === "sms") {
    return { success: false, error: "Texts aren't sent from the chat: message them from WhatsApp Business instead.", status: 400 };
  }
  if (channel === "email") {
    recipientEmail = await getConversationMemberEmail(existingConversation);
    if (!recipientEmail) {
      return { success: false, error: "This conversation has no email address on file.", status: 400 };
    }
  }

  const { error } = await admin.from("chat_messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    sender_is_coach: true,
    body: trimmed,
    channel,
    attachment_path: input.attachmentPath ?? null,
    attachment_type: input.attachmentType ?? null,
    attachment_name: input.attachmentName ?? null,
    // Only when there is one: a database not yet migrated for it still takes every other message.
    ...(input.paymentRequestId ? { payment_request_id: input.paymentRequestId } : {}),
  });

  if (error) return { success: false, error: "Could not send your message.", status: 500 };

  // A coach replying means the conversation is active again, whatever its
  // completed state was.
  const now = new Date().toISOString();
  await admin
    .from("chat_conversations")
    .update({
      last_message_at: now,
      coach_last_read_at: now,
      completed_at: null,
      completed_by: null,
    })
    .eq("id", conversationId);
  // Their new bookings have had a reply: contacted (the job's step in the chat).
  await admin
    .from("enquiries")
    .update({ status: "contacted", updated_at: now, updated_by: user.id })
    .eq("conversation_id", conversationId)
    .eq("status", "new");

  // The name an admin chose for them, if any (lib/staff-identity.ts).
  const coachName = (await staffIdentity(user)).name;
  // A link in the message ("[free trial](https://…)") reads as
  // "free trial (https://…)" anywhere that can't show a real link.
  const plainText = chatBodyToPlainText(trimmed);

  // Best-effort — the in-app message above is already saved either way, so
  // a delivery failure here shouldn't look like the whole send failed.
  try {
    if (channel === "email" && recipientEmail) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `Message from ${CLUB.name}`,
        html: contactMessageEmailHtml({ subject: `Message from ${CLUB.name}`, message: plainText }),
      });
    } else if (channel === "chat" && trimmed) {
      // A plain in-app reply still reaches someone who wrote in from the
      // website and has since closed it — by email, with the reply in it,
      // and a Reply-To that lands back here. Decides for itself whether
      // that's needed (see notifyMemberOfReply).
      await notifyMemberOfReply({ conversation: existingConversation, coachName, message: plainText });
    }
  } catch (deliveryError) {
    console.error(`deliverCoachMessage: ${channel} delivery failed`, deliveryError);
  }

  // Anyone with the app on their phone hears about a coach reply as a push,
  // whatever channel it also went out on. Not only those whose last message
  // came from the app: a parent who last wrote on the website (or never
  // wrote, the coach starting the thread) got no push at all, and after the
  // one email per burst, nothing.
  if (await hasPushDevice(existingConversation.userId)) {
    await pushMemberCoachReply({
      conversationId,
      memberUserId: existingConversation.userId,
      coachName,
      body: plainText,
    });
  }

  return { success: true };
}
