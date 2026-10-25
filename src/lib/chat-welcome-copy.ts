// The words of MPE's chat flow (lib/chat-welcome.ts), kept apart from it so
// the chat in the browser can recognise the ask and the app suggestion and
// show the right card under them (components/chat/customer-chat.tsx).
import { CLUB } from "@/lib/club";

export const WELCOME_BODY = `Hi, welcome to ${CLUB.name}! How can we help today?`;

const ASK_LEAD = "Thanks, we've got your message.";
const ASK_TAIL = "Then an engineer can get back to you as soon as possible, even if you close this page.";
export const DETAILS_ASK_BOTH = `${ASK_LEAD} What's your email address and mobile number? ${ASK_TAIL}`;
export const DETAILS_ASK_EMAIL = `${ASK_LEAD} What's your email address? ${ASK_TAIL}`;
export const DETAILS_ASK_MOBILE = `${ASK_LEAD} What's your mobile number? ${ASK_TAIL}`;

/** Store links once the MPE app is out (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL). */
export function appLinks(): { appStore: string | null; playStore: string | null } {
  return {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
    playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
  };
}

export const APP_PROMPT_BODY = `Thanks! Download the ${CLUB.name} app to get a notification the moment an engineer replies.`;
export const NO_APP_PROMPT_BODY = "Thanks! We'll email you the moment an engineer replies.";

/** What the details form under an ask should collect, or null if the message isn't an ask. */
export function detailsAskFor(body: string): { email: boolean; mobile: boolean } | null {
  if (body === DETAILS_ASK_BOTH) return { email: true, mobile: true };
  if (body === DETAILS_ASK_EMAIL) return { email: true, mobile: false };
  if (body === DETAILS_ASK_MOBILE) return { email: false, mobile: true };
  return null;
}

export function isAppPrompt(body: string): boolean {
  return body === APP_PROMPT_BODY;
}

