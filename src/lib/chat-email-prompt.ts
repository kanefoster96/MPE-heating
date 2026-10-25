import { createAdminClient } from "@/lib/supabase/admin";
import { isGuestUser } from "@/lib/chat-db";

type Admin = ReturnType<typeof createAdminClient>;

/** How long a website visitor waits before we ask for a way to reach them. */
const QUIET_MS = 60 * 1000;

/** Only worth asking while the enquiry is fresh — a day-old thread is a job for the inbox, not a prompt. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const EMAIL_PROMPT_BODY =
  "Thanks for your message! All our coaches are with classes or families right now. Pop your email address in here and we'll come straight back to you — usually within a few hours.";

/** The first thing that looks like an email address in a message. */
export function extractEmail(text: string): string | null {
  const match = /[^\s<>()[\],;:"]+@[^\s<>()[\],;:"]+\.[a-z]{2,}/i.exec(text ?? "");
  if (!match) return null;
  return match[0].replace(/[.,;:]+$/, "").toLowerCase();
}

/**
 * Saves an email a visitor typed into the chat, so a coach can get back to
 * them later. Only fills a blank — someone mentioning another address
 * later never overwrites the one we're using. Best-effort and silent: the
 * message itself has already been sent.
 */
export async function captureGuestEmailFromMessage(
  admin: Admin,
  conversationId: string,
  body: string,
): Promise<void> {
  try {
    const email = extractEmail(body);
    if (!email) return;
    await admin
      .from("chat_conversations")
      .update({ guest_email: email })
      .eq("id", conversationId)
      .is("guest_email", null);
  } catch (err) {
    console.error("captureGuestEmailFromMessage failed", err);
  }
}

export type EmailPromptSweepResult = { asked: number };

/**
 * A website visitor wrote in, a minute has gone by, and no coach has
 * replied — ask them for an email address so the enquiry isn't lost when
 * they close the tab. Only for people we have no way of reaching: someone
 * with an account, or who's already left an email, is never asked.
 *
 * Asked once per conversation (email_prompt_sent_at), so a second quiet
 * stretch doesn't repeat it. Safe to run every minute.
 */
export async function runChatEmailPromptSweep(): Promise<EmailPromptSweepResult> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: conversations } = await admin
    .from("chat_conversations")
    .select("id, user_id, guest_email, phone, last_message_at, email_prompt_sent_at")
    .is("email_prompt_sent_at", null)
    .is("guest_email", null)
    .lte("last_message_at", new Date(now - QUIET_MS).toISOString())
    .gte("last_message_at", new Date(now - MAX_AGE_MS).toISOString())
    // Newest first: older chats that were skipped (members, or a coach had
    // the last word) would otherwise fill the 50 and block new guests.
    .order("last_message_at", { ascending: false })
    .limit(200);

  let asked = 0;

  for (const conversation of conversations ?? []) {
    // A caller or texter is reached by text, not live chat — the prompt
    // would sit in a thread they'll never see.
    if (conversation.phone) continue;
    try {
      // The last word has to be theirs: a coach who replied (or an earlier
      // prompt of ours) means there's nothing to chase.
      const { data: lastMessages } = await admin
        .from("chat_messages")
        .select("sender_is_coach, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const last = (lastMessages ?? [])[0];
      if (!last || last.sender_is_coach) continue;
      if (now - new Date(last.created_at).getTime() < QUIET_MS) continue;

      // Only someone we genuinely can't reach. A member's email is on
      // their account, so they'd only be puzzled by the question.
      const { data: userData } = await admin.auth.admin.getUserById(conversation.user_id);
      if (!isGuestUser(userData?.user) || userData?.user?.email) continue;

      const { error } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id,
        // The academy asking, not any one coach.
        sender_id: null,
        sender_is_coach: true,
        body: EMAIL_PROMPT_BODY,
      });
      if (error) {
        console.error("chat email prompt: insert failed", error);
        continue;
      }

      // Deliberately not touching last_message_at: this is our nudge, not
      // a reply, so the thread keeps its place in the coach's inbox.
      await admin
        .from("chat_conversations")
        .update({ email_prompt_sent_at: new Date().toISOString() })
        .eq("id", conversation.id);

      asked++;
    } catch (err) {
      console.error("chat email prompt: conversation failed", conversation.id, err);
    }
  }

  return { asked };
}
