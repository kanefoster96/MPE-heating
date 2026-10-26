import { NextResponse } from "next/server";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { validateTwilioSignature } from "@/lib/twilio";
import { logUsage } from "@/lib/twilio-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversationByPhone } from "@/lib/chat-db";
import {
  smsKeywordFor,
  recordSmsOptOut,
  clearSmsOptOut,
  SMS_HELP_REPLY,
  SMS_STOP_REPLY,
  SMS_START_REPLY,
} from "@/lib/sms-opt-out";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twimlResponse(status: number) {
  return new NextResponse(EMPTY_TWIML, { status, headers: { "Content-Type": "text/xml" } });
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A one-off automatic reply — only ever for the STOP/START/HELP keywords; everything else is answered by a coach. */
function twimlReply(message: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

/**
 * Twilio's "a message comes in" webhook for the SMS phone number — a text
 * from an unrecognized number gets its own conversation (see
 * getOrCreateConversationByPhone in lib/chat-db.ts), same shared inbox as
 * every other channel. Never auto-replies (empty TwiML) — a coach replies
 * from the normal chat composer, same as any other message — except for
 * the compliance keywords: STOP (and its synonyms) opts the number out of
 * every future text from us and confirms; START opts back in; HELP/INFO
 * gets our contact details. Those still land in the conversation so a
 * coach can see them, but don't buzz anyone's phone.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-twilio-signature");

  if (!signature || !process.env.TWILIO_AUTH_TOKEN) {
    return twimlResponse(403);
  }

  const params = new URLSearchParams(rawBody);
  const paramsObject = Object.fromEntries(params.entries());

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhooks/twilio`;
  const isValid = validateTwilioSignature(process.env.TWILIO_AUTH_TOKEN, signature, url, paramsObject);
  if (!isValid) {
    return twimlResponse(403);
  }

  const from = paramsObject.From;
  const body = paramsObject.Body;
  if (!from || !body) return twimlResponse(200);
  // Counted against the month's calls and texts allowance (lib/twilio-usage.ts).
  await logUsage("text_in", Math.max(1, Number(paramsObject.NumSegments) || 1));

  const keyword = smsKeywordFor(body);

  // Honour the opt-out first, before anything that could fail — a STOP
  // must take effect even if filing it into the chat doesn't.
  try {
    if (keyword === "stop") await recordSmsOptOut(from, body.trim());
    if (keyword === "start") await clearSmsOptOut(from);
  } catch (err) {
    console.error("Twilio webhook: failed to record opt-out change", err);
  }

  try {
    const conversation = await getOrCreateConversationByPhone(from);
    if (conversation) {
      const admin = createAdminClient();
      const { error } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id,
        sender_id: conversation.userId,
        sender_is_coach: false,
        channel: "sms",
        body: body.trim(),
      });
      if (error) {
        console.error("Twilio webhook: message insert failed", error);
      } else {
        // Same reopen-on-reply behavior as sendMemberMessage — a text landing
        // on an already-"complete" conversation reopens it automatically.
        await admin
          .from("chat_conversations")
          .update({ last_message_at: new Date().toISOString(), completed_at: null, completed_by: null })
          .eq("id", conversation.id);

        if (!keyword) {
          await notifyStaffOfFamilyMessage({
            conversationId: conversation.id,
            fromName: conversation.guestName ? `${conversation.guestName} (text)` : `Text from ${from}`,
            body: body.trim(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Twilio webhook: failed to process inbound message", err);
  }

  if (keyword === "stop") return twimlReply(SMS_STOP_REPLY);
  if (keyword === "start") return twimlReply(SMS_START_REPLY);
  if (keyword === "help") return twimlReply(SMS_HELP_REPLY);
  return twimlResponse(200);
}
