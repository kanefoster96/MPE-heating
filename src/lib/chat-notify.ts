import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { chatReplyEmailHtml } from "@/lib/emails/chat-reply";
import { getConversationMemberEmail } from "@/lib/chat-db";
import type { Conversation } from "@/lib/chat";
import { CLUB } from "@/lib/club";

/**
 * Domain the reply-by-email addresses live on (e.g. chat.kanvasacademy.com)
 * — a subdomain with its MX record pointed at Resend's inbound servers, so
 * it never competes with the real mailbox on the root domain. Unset means
 * notification emails still go out, they just can't be replied to: the
 * "open the chat" button is the only way back.
 */
const CHAT_REPLY_DOMAIN = process.env.CHAT_REPLY_DOMAIN?.trim() || null;

/** "In the chat right now" — a heartbeat this recent means they'll see the reply on screen, so no email. */
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

const REPLY_LOCAL_PART = "reply";

export function replyAddressFor(token: string): string | null {
  return CHAT_REPLY_DOMAIN
    ? `${CLUB.name} <${REPLY_LOCAL_PART}+${token}@${CHAT_REPLY_DOMAIN}>`
    : null;
}

/** Pulls the conversation token back out of a "reply+TOKEN@…" address (with or without a display name around it). */
export function parseReplyToken(address: string): string | null {
  const match = address.match(new RegExp(`${REPLY_LOCAL_PART}\\+([A-Za-z0-9_-]+)@`, "i"));
  return match ? match[1] : null;
}

function mintReplyToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Decides whether a coach's in-app reply also needs to reach the member by
 * email, and sends it if so. Called best-effort after the message row is
 * already saved — nothing here can make the reply itself fail.
 *
 * Skipped when:
 * - they last wrote from the app (its own unread badge is the notification);
 * - they're in the chat right now (recent heartbeat), so it's on screen;
 * - an email has already gone out since they last read or wrote — one
 *   email per burst of replies, not one per message;
 * - there's no email to send to (an anonymous guest who skipped it).
 *
 * A conversation with no recorded source yet (older than that column, or
 * started by phone) is treated as web, since that's the case where an
 * email is the only way they'd ever know.
 */
export async function notifyMemberOfReply(params: {
  conversation: Conversation;
  coachName: string;
  message: string;
}): Promise<void> {
  const { conversation, coachName, message } = params;

  if (conversation.memberLastSource === "app") return;
  if (conversation.memberNotifiedAt) return;
  if (
    conversation.memberLastActiveAt &&
    Date.now() - new Date(conversation.memberLastActiveAt).getTime() < ACTIVE_WINDOW_MS
  ) {
    return;
  }

  const email = await getConversationMemberEmail(conversation);
  if (!email) return;

  const admin = createAdminClient();

  let replyToken: string | null = null;
  if (CHAT_REPLY_DOMAIN) {
    const { data: row } = await admin
      .from("chat_conversations")
      .select("reply_token")
      .eq("id", conversation.id)
      .maybeSingle();
    replyToken = row?.reply_token ?? null;
    if (!replyToken) {
      replyToken = mintReplyToken();
      const { error } = await admin
        .from("chat_conversations")
        .update({ reply_token: replyToken })
        .eq("id", conversation.id);
      if (error) replyToken = null;
    }
  }

  const replyTo = replyToken ? replyAddressFor(replyToken) : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    ...(replyTo ? { replyTo } : {}),
    subject: `${coachName} replied to you — ${CLUB.name}`,
    html: chatReplyEmailHtml({
      coachName,
      message,
      chatUrl: `${siteUrl}/messages`,
      canReplyByEmail: !!replyTo,
    }),
  });

  await admin
    .from("chat_conversations")
    .update({ member_notified_at: new Date().toISOString() })
    .eq("id", conversation.id);
}

/**
 * The part of an emailed reply the person actually typed — everything
 * above the quoted copy of our own email that mail clients append. Falls
 * back to the whole text if the markers aren't recognised, since a
 * slightly-too-long message beats a lost one.
 */
export function extractRepliedText(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cutAt = lines.findIndex(
    (line, i) =>
      /^On .{0,200} wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
      /^_{5,}$/.test(line.trim()) ||
      line.trim().startsWith(">") ||
      // Outlook-style header block: "From: …" immediately followed by Sent:/Date:/To:.
      (/^From:\s/.test(line) && /^(Sent|Date|To):\s/.test(lines[i + 1] ?? "")),
  );
  const own = (cutAt === -1 ? lines : lines.slice(0, cutAt)).join("\n").trim();
  return (own || text.trim()).slice(0, 5000);
}

/** "Jane <jane@example.com>" / "jane@example.com" → "jane@example.com" (lowercased). */
export function extractEmailAddress(value: string): string | null {
  const match = value.match(/<([^>]+)>/) ?? value.match(/([^\s<>"]+@[^\s<>"]+)/);
  return match ? match[1].trim().toLowerCase() : null;
}
