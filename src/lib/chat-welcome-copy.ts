// The words of MPE's chat flow (lib/chat-welcome.ts), kept apart from it so
// the chat in the browser can recognise the ask and the app suggestion and
// show the right card under them (components/chat/customer-chat.tsx).
import { CLUB } from "@/lib/club";

export const WELCOME_BODY = `Hi, welcome to ${CLUB.name}! How can we help today?`;

const ASK_LEAD = "Thanks, we've got your message.";
const ASK_TAIL = "Then an engineer can get back to you as soon as possible, even if you close this page.";
export const DETAILS_ASK_BOTH = `${ASK_LEAD} What's your name, postcode, email address and mobile number? ${ASK_TAIL}`;
export const DETAILS_ASK_EMAIL = `${ASK_LEAD} What's your name, postcode and email address? ${ASK_TAIL}`;
export const DETAILS_ASK_MOBILE = `${ASK_LEAD} What's your name, postcode and mobile number? ${ASK_TAIL}`;

const GAS = "If you can smell gas, call the National Gas Emergency Service on 0800 111 999.";
const AWAY = `${ASK_LEAD} Our team aren't on the chat right now`;
/** Out of hours (lib/team-hours.ts, "8am to 8pm"): the ask, saying the team aren't on the chat. The card under it asks for whatever's missing. */
export function detailsAskAfterHours(hours: string): string {
  return `${AWAY}: we're here from ${hours}. Leave your details below and an engineer will get back to you. ${GAS}`;
}
/** Out of hours, from someone we can already reach: once a night. */
export function afterHoursBody(hours: string): string {
  return `${AWAY}: we're here from ${hours}, and an engineer will get back to you. ${GAS}`;
}

// The asks before name and postcode were added: their cards still show in older chats.
const OLD_ASK_BOTH = `${ASK_LEAD} What's your email address and mobile number? ${ASK_TAIL}`;
const OLD_ASK_EMAIL = `${ASK_LEAD} What's your email address? ${ASK_TAIL}`;
const OLD_ASK_MOBILE = `${ASK_LEAD} What's your mobile number? ${ASK_TAIL}`;

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
  // Out of hours: whatever the hours were, the card asks for whatever's missing.
  if (body === DETAILS_ASK_BOTH || body === OLD_ASK_BOTH || (body.startsWith(AWAY) && body.includes("Leave your details below"))) return { email: true, mobile: true };
  if (body === DETAILS_ASK_EMAIL || body === OLD_ASK_EMAIL) return { email: true, mobile: false };
  if (body === DETAILS_ASK_MOBILE || body === OLD_ASK_MOBILE) return { email: false, mobile: true };
  return null;
}

export function isAppPrompt(body: string): boolean {
  return body === APP_PROMPT_BODY;
}

