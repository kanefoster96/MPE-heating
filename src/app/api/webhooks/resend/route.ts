import { NextResponse } from "next/server";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConversationByReplyToken, getConversationMemberEmail } from "@/lib/chat-db";
import { parseReplyToken, extractRepliedText, extractEmailAddress } from "@/lib/chat-notify";
import { contactMessageEmailHtml } from "@/lib/emails/contact-message";

/**
 * Resend's inbound-email webhook — the other half of reply-by-email. A
 * "you've got a reply" email (lib/chat-notify.ts) carries
 * reply+<token>@$CHAT_REPLY_DOMAIN as its Reply-To; when the person answers
 * it from their inbox, Resend receives it (MX on that subdomain), fires
 * email.received here, and the typed part of their reply becomes a normal
 * member message in the conversation the token belongs to.
 *
 * Trust model: the token is unguessable and the only link to a
 * conversation, and on top of that the sender address has to match the
 * email we sent the notification to. Anything that fails either check is
 * dropped with a 200 — returning an error would just make Resend retry.
 * Every response is 200 apart from a bad signature (400) or the secret not
 * being configured yet (503), which is what Resend's retry logic expects.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: event.type });

  const { email_id: emailId, message_id: messageId, from, to, received_for: receivedFor } = event.data;

  const token = [...(receivedFor ?? []), ...(to ?? [])].map(parseReplyToken).find((t): t is string => !!t);
  if (!token) return NextResponse.json({ ok: true, ignored: "no reply token" });

  const conversation = await getConversationByReplyToken(token);
  if (!conversation) return NextResponse.json({ ok: true, ignored: "unknown token" });

  const expectedEmail = (await getConversationMemberEmail(conversation))?.toLowerCase() ?? null;
  const senderEmail = extractEmailAddress(from);
  if (!expectedEmail || !senderEmail || senderEmail !== expectedEmail) {
    console.warn("Resend webhook: sender does not match conversation email", { conversationId: conversation.id });
    return NextResponse.json({ ok: true, ignored: "sender mismatch" });
  }

  const { data: received, error: fetchError } = await resend.emails.receiving.get(emailId);
  if (fetchError || !received) {
    console.error("Resend webhook: could not fetch received email", fetchError);
    // Signal a retry — the email exists, we just couldn't read it this time.
    return NextResponse.json({ error: "Could not fetch email" }, { status: 500 });
  }

  const rawText = received.text ?? htmlToText(received.html ?? "");
  const body = extractRepliedText(rawText);
  if (!body) return NextResponse.json({ ok: true, ignored: "empty" });

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("chat_messages").insert({
    conversation_id: conversation.id,
    sender_id: conversation.userId,
    sender_is_coach: false,
    channel: "email",
    body,
    email_message_id: messageId,
  });

  if (insertError) {
    // Unique violation on email_message_id — Resend re-delivered an email
    // we've already stored, so this is a successful no-op.
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("Resend webhook: message insert failed", insertError);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Same bookkeeping as a message typed into the site: it's the latest
  // activity, it reopens a completed thread, it tells us they're a web
  // (not app) contact, and it re-arms the next reply notification.
  await admin
    .from("chat_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      completed_at: null,
      completed_by: null,
      member_last_source: "web",
      member_notified_at: null,
    })
    .eq("id", conversation.id);

  // Emailed replies deliberately don't push to the app — by request, they
  // get read like any other email. But they arrive at Resend, not a
  // mailbox, so a copy is forwarded to the contact inbox to make that
  // true. Coach replies still go through the chat (or the email channel),
  // so replying to this forward from the inbox wouldn't reach them.
  const inbox = process.env.CONTACT_TO_EMAIL;
  if (inbox) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: inbox,
        subject: `Chat reply from ${conversation.guestName || senderEmail}`,
        html: contactMessageEmailHtml({
          subject: `${conversation.guestName || senderEmail} replied by email`,
          message: `${body}\n\nReply in the chat: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/coach/messages/${conversation.id}`,
        }),
      });
    } catch (forwardError) {
      console.error("Resend webhook: inbox forward failed", forwardError);
    }
  }

  return NextResponse.json({ ok: true });
}

/** Last-resort plain text for an HTML-only reply — good enough for a chat bubble, not a faithful conversion. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
