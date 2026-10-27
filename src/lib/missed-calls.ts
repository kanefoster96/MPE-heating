import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversationByPhone } from "@/lib/chat-db";
import { chatRecipientIds, notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";
import { customerForConversation } from "@/lib/customers";
import { sendSms, smsAllowed, validateTwilioSignature } from "@/lib/twilio";
import { billedMinutes, logUsage, usagePaused } from "@/lib/twilio-usage";
import { SmsOptedOutError } from "@/lib/sms-opt-out";
import { callableUkNumber, coachPhoneOf } from "@/lib/coach-calls";
import { business } from "@/lib/content";
import { formatPhone } from "@/lib/phone";
import { CLUB, clubLink } from "@/lib/club";
import { londonNow } from "@/lib/schedule-time";

/**
 * Calls to the MPE (Twilio) number. It rings Fergal first (every admin's
 * saved mobile, else his), so customers only ever see the MPE number.
 * Answered or not, the call is logged in that number's conversation, and
 * the caller gets one text after it pointing them at the app and live
 * chat, where updates are free: texts and calls cost per use, so the aim
 * is that they lead back to the app or the website.
 *
 *   /api/webhooks/twilio/voice               "A call comes in": ring Fergal
 *   /api/webhooks/twilio/voice/after         the ringing ended: answered, or voicemail
 *   /api/webhooks/twilio/voice/done          after the voicemail, hang up
 *   /api/webhooks/twilio/voice/recording     voicemail audio is ready
 *   /api/webhooks/twilio/voice/transcription voicemail text is ready
 *
 * Nothing runs until the number's "A call comes in" webhook in the Twilio
 * console points at the first of those.
 */

/* Read aloud inside TwiML <Say>, so XML-escaped. */
const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SPOKEN_NAME = xml(CLUB.name);
const SPOKEN_DOMAIN = xml(CLUB.domainSpoken);

// One text each, under 160 characters (one segment, the cheapest a text
// gets). The link is the website's Get the app page, which sends a phone
// to its app store, with live chat there for anyone without the app.

/** Sent the moment Fergal answers, so he can ask them to install the app from it while they're talking: tracking the job and chatting for free. */
export const AFTER_CALL_TEXT = `Thanks for calling ${CLUB.name}. Get the MPE app to track your job and live chat with your engineer: ${clubLink("/app")}`;

/** After a call nobody answered: someone will get back to them, and the app's quicker. */
export const MISSED_CALL_TEXT = `Sorry we missed your call. An ${CLUB.name} engineer will get back to you soon, or live chat with us now in the MPE app: ${clubLink("/app")}`;

/** Rings before going to MPE's voicemail: short, so Fergal's own voicemail never picks it up. */
const RING_SECONDS = 18;

/** Calls ring Fergal from 8am to 8pm (London), every day; outside that, straight to voicemail. */
const CALLS_FROM = 8 * 60;
const CALLS_UNTIL = 20 * 60;

/** Whether a call to the MPE number rings the team now. */
export function callsOpen(): boolean {
  const { minutes } = londonNow();
  return minutes >= CALLS_FROM && minutes < CALLS_UNTIL;
}

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

export function callbackUrl(path: string, conversationId: string | null, caller: string | null = null, extra: Record<string, string> = {}): string {
  const base = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhooks/twilio/voice${path}`;
  const query = new URLSearchParams({ ...(conversationId ? { c: conversationId } : {}), ...(caller ? { from: caller } : {}), ...extra }).toString();
  return (query ? `${base}?${query}` : base).replace(/&/g, "&amp;");
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


/** The phones a call to the MPE number rings: every admin's saved mobile, else Fergal's. */
async function ringNumbers(): Promise<string[]> {
  const admin = createAdminClient();
  const { data: roles } = await admin.from("user_roles").select("email").eq("role", "admin");
  const adminEmails = new Set((roles ?? []).map((r) => String(r.email).toLowerCase()));
  const { data: page } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const numbers = (page?.users ?? [])
    .filter((u) => u.email && adminEmails.has(u.email.toLowerCase()))
    .map((u) => coachPhoneOf(u))
    .filter((n): n is string => !!n);
  const fallback = callableUkNumber(business.engineerMobile);
  return [...new Set(numbers.length ? numbers : fallback ? [fallback] : [])];
}

/**
 * The incoming call: logged in the caller's chat, then Fergal's phone
 * rings (showing the caller's number). What happens next is in
 * handleAfterDial, once the ringing ends.
 */
export async function handleIncomingCall(from: string | undefined): Promise<Response> {
  const caller = from && from.startsWith("+") ? from : null; // withheld numbers arrive as "anonymous" etc.
  let conversationId: string | null = null;
  let tip: { name: string; textedBefore: boolean } | null = null;
  // The month's calls and texts allowance is used and Settings says pause:
  // a short message pointing at the app (about a penny), and it's logged.
  const paused = await usagePaused().catch(() => false);
  if (caller) {
    try {
      const conversation = await getOrCreateConversationByPhone(caller);
      conversationId = conversation?.id ?? null;
      if (conversation) {
        await createAdminClient().from("chat_messages").insert({
          conversation_id: conversation.id,
          sender_id: conversation.userId,
          sender_is_coach: false,
          channel: "sms",
          body: paused ? "Called the MPE number (calls paused for the month)" : callsOpen() ? "Called the MPE number" : "Called the MPE number (out of hours: voicemail)",
        });
        await bumpConversation(conversation.id);
        tip = await phoneOnlyTip(conversation.id, conversation.userId, conversation.guestEmail, conversation.guestName ?? formatPhone(caller));
      }
    } catch (err) {
      console.error("incoming call: failed to file the call", err);
    }
  }

  if (paused) {
    await logUsage("call_in", 1);
    if (conversationId) {
      await notifyStaffOfFamilyMessage({ conversationId, fromName: caller ? `Call from ${formatPhone(caller)}` : "A call", body: "Called while calls are paused" }).catch(() => {});
    }
    return twiml(`<Say ${VOICE}>Thanks for calling ${SPOKEN_NAME}. Please message us in the MPE app or at ${SPOKEN_DOMAIN}, and an engineer will get back to you.</Say><Hangup/>`);
  }

  // Out of hours (8pm to 8am): straight to voicemail, nobody's phone rings, and nobody's
  // woken by a notification; it's waiting in their chat in the morning.
  if (!callsOpen()) {
    await logUsage("call_in", 1);
    if (conversationId && caller) await textAfterCall(conversationId, caller, MISSED_CALL_TEXT).catch(() => false);
    return voicemail(conversationId, true);
  }

  const numbers = await ringNumbers().catch(() => [] as string[]);
  // Someone we can only reach on this number: a tip on Fergal's lock screen as it rings.
  if (tip && conversationId && numbers.length) {
    await pushToUsers(await chatRecipientIds(), {
      title: `${tip.name} is calling`,
      body: tip.textedBefore
        ? "No email or app for them yet. They had the MPE app link by text last time: ask them to install it, so job updates and your arrival time reach them free."
        : "No email or app for them yet. When you answer, they get a text with the MPE app link: ask them to install it, so job updates and your arrival time reach them free.",
      data: { kind: "chat", conversationId },
    }).catch(() => {});
  }
  if (!numbers.length) {
    await logUsage("call_in", 1);
    if (conversationId && caller) await textAfterCall(conversationId, caller, MISSED_CALL_TEXT).catch(() => false);
    return voicemail(conversationId);
  }
  return twiml(
    `<Dial timeout="${RING_SECONDS}" answerOnBridge="true" action="${callbackUrl("/after", conversationId, caller)}">` +
      // The app text goes the moment it's answered (handleAnswered), not after.
      numbers.map((n) => `<Number statusCallbackEvent="answered" statusCallback="${callbackUrl("/answered", conversationId, caller)}">${n}</Number>`).join("") +
      `</Dial>`,
  );
}

/**
 * A caller we can only reach on their phone (no email on file, not in the
 * app): who they are, and whether they've had the app text before.
 * Null for anyone with an email or the app.
 */
async function phoneOnlyTip(conversationId: string, userId: string | null, guestEmail: string | null, name: string): Promise<{ name: string; textedBefore: boolean } | null> {
  const admin = createAdminClient();
  if (guestEmail?.trim()) return null;
  if (userId) {
    const { count } = await admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", userId);
    if (count) return null;
  }
  const customer = await customerForConversation(conversationId).catch(() => null);
  if (customer?.email) return null;
  const { data } = await admin.from("chat_conversations").select("call_text_sent_at").eq("id", conversationId).maybeSingle();
  return { name: customer?.name || name, textedBefore: !!data?.call_text_sent_at };
}

/** Fergal answered: the app text now, while they're still talking (once per number, ever). */
export async function handleAnswered(conversationId: string | null, caller: string | null): Promise<void> {
  if (conversationId && caller) await textAfterCall(conversationId, caller, AFTER_CALL_TEXT).catch(() => false);
}

/**
 * The ringing ended. Answered: logged with how long it took, then the
 * "track it in the app" text. Not answered: the team's told, the caller
 * gets the "we'll call you back" text, and can leave a voicemail.
 */
export async function handleAfterDial(conversationId: string | null, caller: string | null, params: Record<string, string>, outbound = false): Promise<Response> {
  const answered = params.DialCallStatus === "completed";
  const seconds = Number(params.DialCallDuration) || 0;
  // The minutes, for the calls and texts allowance: an outbound call is two calls out
  // (his phone, then theirs); one in is the call in, plus the minutes put through to him.
  if (outbound) {
    if (answered) await logUsage("call_forward", 2 * billedMinutes(seconds));
  } else if (answered) {
    await logUsage("call_in", billedMinutes(seconds + RING_SECONDS));
    await logUsage("call_forward", billedMinutes(seconds));
  } else {
    await logUsage("call_in", 1);
  }
  // Fergal's own call from the MPE number (lib/coach-calls.ts): already logged; they get the app text if they picked up.
  if (outbound) {
    if (answered && conversationId && caller) await textAfterCall(conversationId, caller, AFTER_CALL_TEXT).catch(() => false);
    return twiml("<Hangup/>");
  }
  if (conversationId && caller) {
    try {
      const admin = createAdminClient();
      const { data: conversation } = await admin.from("chat_conversations").select("id, user_id, guest_name").eq("id", conversationId).maybeSingle();
      if (conversation) {
        await admin.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: conversation.user_id,
          sender_is_coach: false,
          channel: "sms",
          body: answered ? `Call answered (${formatDuration(Number(params.DialCallDuration) || 0)})` : "Missed call",
        });
        await bumpConversation(conversationId);
        if (!answered) {
          await notifyStaffOfFamilyMessage({
            conversationId,
            fromName: conversation.guest_name ? `${conversation.guest_name} (call)` : `Call from ${formatPhone(caller)}`,
            body: "Missed call",
          });
        }
        await textAfterCall(conversationId, caller, answered ? AFTER_CALL_TEXT : MISSED_CALL_TEXT);
      }
    } catch (err) {
      console.error("after call: failed to file it", err);
    }
  }
  return answered ? twiml("<Hangup/>") : voicemail(conversationId);
}

/**
 * The one text after someone's first call, to a UK mobile: never again to
 * that number (it pointed them at the app; calling again is their choice),
 * and not at all to someone who already has the app.
 */
async function textAfterCall(conversationId: string, caller: string, body: string): Promise<boolean> {
  if (!isUkMobile(caller)) return false;
  const admin = createAdminClient();
  const { data: conversation } = await admin.from("chat_conversations").select("user_id, call_text_sent_at").eq("id", conversationId).maybeSingle();
  if (!conversation || conversation.call_text_sent_at) return false;
  if (conversation.user_id) {
    const { count } = await admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", conversation.user_id as string);
    if (count) return false;
  }
  if (!(await smsAllowed())) return false;
  // Claimed first, so two calls close together can't both send it.
  const { data: claimed } = await admin.from("chat_conversations").update({ call_text_sent_at: new Date().toISOString() }).eq("id", conversationId).is("call_text_sent_at", null).select("id");
  if (!claimed?.length) return false;
  try {
    await sendSms(caller, body);
    await admin.from("chat_messages").insert({ conversation_id: conversationId, sender_id: null, sender_is_coach: true, channel: "sms", body });
    return true;
  } catch (err) {
    // Opted out with STOP: respect it quietly. Anything else is logged.
    if (!(err instanceof SmsOptedOutError)) console.error("after call: text failed", err);
    return false;
  }
}

/** Nobody picked up (or it's out of hours): MPE's voicemail, filed in their chat. A withheld number is pointed at the website. */
function voicemail(conversationId: string | null, closed = false): Response {
  const why = closed ? "Our phones are open from 8am to 8pm." : "Sorry, our engineer can't get to the phone right now.";
  if (!conversationId) {
    return twiml(`<Say ${VOICE}>Thanks for calling ${SPOKEN_NAME}. ${why} Please visit ${SPOKEN_DOMAIN} to live chat with us.</Say><Hangup/>`);
  }
  const greeting = `Thanks for calling ${SPOKEN_NAME}. ${why} Please leave a message after the tone, or live chat with us in the MPE app or at ${SPOKEN_DOMAIN}.`;
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
  const numbers = await ringNumbers();
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
  // The voicemail's minutes on the call, and written out (the calls and texts allowance).
  if (status === "completed" && duration > 0) {
    await logUsage("call_in", billedMinutes(duration));
    await logUsage("transcription", billedMinutes(duration));
  }
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
  // Out of hours it waits, unread, in their chat for the morning: nobody's woken by it.
  if (callsOpen()) {
    await notifyStaffOfFamilyMessage({
      conversationId,
      fromName: conversation?.guest_name ? `${conversation.guest_name} (call)` : `Call from ${conversation?.phone ?? "unknown number"}`,
      body: label,
    });
  }
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
