import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversationByPhone } from "@/lib/chat-db";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { sendSms, validateTwilioSignature } from "@/lib/twilio";
import { SmsOptedOutError } from "@/lib/sms-opt-out";
import { coachPhoneOf } from "@/lib/coach-calls";
import { CLUB, clubLink } from "@/lib/club";

/* Read aloud inside TwiML <Say>, so XML-escaped. */
const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SPOKEN_NAME = xml(CLUB.name);
const SPOKEN_DOMAIN = xml(CLUB.domainSpoken);

/**
 * Calls to the Twilio number. Nobody answers live: the caller hears a short
 * greeting, can leave a voicemail, and a UK mobile gets a text pointing them
 * at the live chat. All of it lands in that number's conversation in the
 * chat inbox, so a coach picks it up from the app like any other message:
 *
 *   /api/webhooks/twilio/voice               "A call comes in"
 *   /api/webhooks/twilio/voice/done          after the voicemail, hang up
 *   /api/webhooks/twilio/voice/recording     voicemail audio is ready
 *   /api/webhooks/twilio/voice/transcription voicemail text is ready
 *
 * Nothing runs until the number's "A call comes in" webhook in the Twilio
 * console points at the first of those.
 */

// Our engineers are on jobs, so a call often goes unanswered: the text
// says we'll call back, and offers the live chat (/messages, where a guest
// can type straight away with no account) as the quicker route.
export const MISSED_CALL_TEXT =
  `Thanks for calling ${CLUB.name}. Our engineers are busy on a job right now, but we'll call you back as soon as we can. Or start a live chat and we'll reply there: ${clubLink("/messages")}`;

/** Don't text the same number twice for calls close together. */
const TEXT_BACK_COOLDOWN_HOURS = 12;

const VOICE = 'voice="Polly.Amy-Neural" language="en-GB"';

export function isUkMobile(phone: string): boolean {
  return /^\+447\d{9}$/.test(phone);
}

/**
 * Checks the X-Twilio-Signature against the URL Twilio called (query string
 * included, which is what makes the ?c=<conversation> on the callbacks
 * trustworthy) and returns the posted fields, or null if it doesn't verify.
 */
export async function readTwilioRequest(request: Request): Promise<Record<string, string> | null> {
  const signature = request.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return null;

  const params = Object.fromEntries(new URLSearchParams(await request.text()).entries());
  const { pathname, search } = new URL(request.url);
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}${pathname}${search}`;
  return validateTwilioSignature(authToken, signature, url, params) ? params : null;
}

export function twiml(inner: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

function callbackUrl(path: string, conversationId: string | null): string {
  const base = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhooks/twilio/voice${path}`;
  const url = conversationId ? `${base}?c=${encodeURIComponent(conversationId)}` : base;
  return url.replace(/&/g, "&amp;");
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function bumpConversation(conversationId: string) {
  await createAdminClient()
    .from("chat_conversations")
    .update({ last_message_at: new Date().toISOString(), completed_at: null, completed_by: null })
    .eq("id", conversationId);
}

/** True if this conversation was already sent the missed-call text recently. */
async function textedRecently(conversationId: string): Promise<boolean> {
  const since = new Date(Date.now() - TEXT_BACK_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await createAdminClient()
    .from("chat_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("sender_is_coach", true)
    .eq("body", MISSED_CALL_TEXT)
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * The incoming call: file it in the chat, text a mobile back, and answer
 * with the greeting and a voicemail prompt. Each step is best-effort, so a
 * hiccup filing the call never leaves the caller in silence.
 */
export async function handleIncomingCall(from: string | undefined): Promise<Response> {
  const caller = from && from.startsWith("+") ? from : null; // withheld numbers arrive as "anonymous" etc.
  let conversationId: string | null = null;
  let texted = false;

  if (caller) {
    try {
      const conversation = await getOrCreateConversationByPhone(caller);
      conversationId = conversation?.id ?? null;
      if (conversation) {
        const admin = createAdminClient();
        await admin.from("chat_messages").insert({
          conversation_id: conversation.id,
          sender_id: conversation.userId,
          sender_is_coach: false,
          channel: "sms",
          body: "Missed call",
        });

        if (isUkMobile(caller) && !(await textedRecently(conversation.id))) {
          try {
            await sendSms(caller, MISSED_CALL_TEXT);
            texted = true;
            await admin.from("chat_messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              sender_is_coach: true,
              channel: "sms",
              body: MISSED_CALL_TEXT,
            });
          } catch (err) {
            // Opted out with STOP: respect it quietly. Anything else is logged.
            if (!(err instanceof SmsOptedOutError)) console.error("missed call: text back failed", err);
          }
        }

        await bumpConversation(conversation.id);
        await notifyStaffOfFamilyMessage({
          conversationId: conversation.id,
          fromName: conversation.guestName ? `${conversation.guestName} (call)` : `Call from ${caller}`,
          body: "Missed call",
        });
      }
    } catch (err) {
      console.error("missed call: failed to file the call", err);
    }
  }

  // A withheld number has no conversation to file a voicemail in, and no
  // way to be called or texted back, so point them at the website instead.
  if (!conversationId) {
    return twiml(
      `<Say ${VOICE}>Thanks for calling ${SPOKEN_NAME}. We can't take your call right now. Please visit ${SPOKEN_DOMAIN} to get in touch.</Say><Hangup/>`,
    );
  }

  const greeting = texted
    ? `Thanks for calling ${SPOKEN_NAME}. We can't take your call right now, but we've just sent you a text with the quickest way to reach us. Or leave a message after the tone.`
    : `Thanks for calling ${SPOKEN_NAME}. We can't take your call right now. Please leave a message after the tone, or visit ${SPOKEN_DOMAIN}.`;

  // Twilio's built-in transcription caps the recording at two minutes.
  return twiml(
    `<Say ${VOICE}>${greeting}</Say>` +
      `<Record maxLength="120" timeout="5" playBeep="true" trim="trim-silence" ` +
      `action="${callbackUrl("/done", null)}" ` +
      `recordingStatusCallback="${callbackUrl("/recording", conversationId)}" recordingStatusCallbackEvent="completed" ` +
      `transcribe="true" transcribeCallback="${callbackUrl("/transcription", conversationId)}"/>`,
  );
}

/**
 * "Forward mode" (?mode=forward on the voice webhook): no greeting, no text
 * back, the call just rings every admin who has saved a callback number
 * (lib/coach-calls.ts). For things like WhatsApp's verification call, where
 * a robot reads out a code the moment the line is answered.
 */
export async function forwardToAdmins(): Promise<Response> {
  const admin = createAdminClient();
  const { data: roles } = await admin.from("user_roles").select("email").eq("role", "admin");
  const adminEmails = new Set((roles ?? []).map((r) => String(r.email).toLowerCase()));
  const { data: page } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const numbers = (page?.users ?? [])
    .filter((u) => u.email && adminEmails.has(u.email.toLowerCase()))
    .map((u) => coachPhoneOf(u))
    .filter((n): n is string => !!n);

  if (numbers.length === 0) {
    return twiml(`<Say ${VOICE}>Sorry, there's nobody to put you through to.</Say><Hangup/>`);
  }
  return twiml(`<Dial timeout="40">${numbers.map((n) => `<Number>${n}</Number>`).join("")}</Dial>`);
}

export function finishCall(): Response {
  return twiml(`<Say ${VOICE}>Thank you, goodbye.</Say><Hangup/>`);
}

function voicemailPath(conversationId: string, recordingSid: string) {
  return `${conversationId}/voicemail-${recordingSid}.mp3`;
}

/**
 * The voicemail audio is ready: copy it into the chat's attachment storage
 * (Twilio's own copy needs the account's credentials to play) and post it
 * in the conversation as a playable file.
 */
export async function handleRecording(conversationId: string | null, params: Record<string, string>): Promise<void> {
  const { RecordingUrl: recordingUrl, RecordingSid: recordingSid, RecordingStatus: status } = params;
  const duration = Number(params.RecordingDuration ?? 0);
  // Under two seconds is a hang-up at the beep, not a message.
  if (!conversationId || !recordingUrl || !recordingSid || status !== "completed" || duration < 2) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const res = await fetch(`${recordingUrl}.mp3`, {
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` },
  });
  if (!res.ok) {
    console.error("voicemail: could not download recording", res.status);
    return;
  }

  const admin = createAdminClient();
  const path = voicemailPath(conversationId, recordingSid);
  const { error: uploadError } = await admin.storage
    .from("chat-attachments")
    .upload(path, Buffer.from(await res.arrayBuffer()), { contentType: "audio/mpeg", upsert: true });
  if (uploadError) {
    console.error("voicemail: upload failed", uploadError);
    return;
  }

  const { data: conversation } = await admin.from("chat_conversations").select("user_id, guest_name, phone").eq("id", conversationId).maybeSingle();
  const label = `Voicemail (${formatDuration(duration)})`;

  // The transcript can occasionally arrive first; if it has, fold the audio into that message.
  const { data: existing } = await admin
    .from("chat_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("attachment_path", path)
    .maybeSingle();
  if (existing) return;

  await admin.from("chat_messages").insert({
    conversation_id: conversationId,
    sender_id: conversation?.user_id ?? null,
    sender_is_coach: false,
    channel: "sms",
    body: label,
    attachment_path: path,
    attachment_type: "file",
    attachment_name: `${label}.mp3`,
  });
  await bumpConversation(conversationId);
  await notifyStaffOfFamilyMessage({
    conversationId,
    fromName: conversation?.guest_name ? `${conversation.guest_name} (call)` : `Call from ${conversation?.phone ?? "unknown number"}`,
    body: label,
  });
}

/** The voicemail's text is ready: add it to the voicemail message so it can be read without playing it. */
export async function handleTranscription(conversationId: string | null, params: Record<string, string>): Promise<void> {
  const { TranscriptionText: text, TranscriptionStatus: status, RecordingSid: recordingSid } = params;
  if (!conversationId || !recordingSid || status !== "completed" || !text?.trim()) return;

  const admin = createAdminClient();
  const path = voicemailPath(conversationId, recordingSid);
  const { data: message } = await admin
    .from("chat_messages")
    .select("id, body")
    .eq("conversation_id", conversationId)
    .eq("attachment_path", path)
    .maybeSingle();

  if (message) {
    await admin.from("chat_messages").update({ body: `${message.body}: "${text.trim()}"` }).eq("id", message.id);
  } else {
    const { data: conversation } = await admin.from("chat_conversations").select("user_id").eq("id", conversationId).maybeSingle();
    await admin.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: conversation?.user_id ?? null,
      sender_is_coach: false,
      channel: "sms",
      body: `Voicemail: "${text.trim()}"`,
    });
    await bumpConversation(conversationId);
  }
}
