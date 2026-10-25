// Links inside chat messages. A coach's message can carry a link written
// as [text](https://…), or pasted on its own (https://…, www.…), which the
// site and app render as a tappable link
// and every plain-text channel (a text message, an email, a push, the
// inbox preview) shows as "text (https://…)". Only http(s) links count,
// and only coaches' messages are rendered with links — a member's message
// is always shown as plain text. Mirrored by hand in mobile/lib/chat-links.ts.

export type ChatBodyPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

// A bare address pasted into a message: https://…, http://… or www.…
// Punctuation that usually ends the sentence rather than the address
// (a full stop, comma, closing bracket) is left out of the link.
const BARE_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?'")\]]+$/;

function splitBareUrls(text: string): ChatBodyPart[] {
  const parts: ChatBodyPart[] = [];
  let last = 0;
  for (const match of text.matchAll(BARE_URL_RE)) {
    const index = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION_RE, "");
    if (!url) continue;
    if (index > last) parts.push({ type: "text", text: text.slice(last, index) });
    parts.push({ type: "link", text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = index + url.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

export function parseChatBody(body: string): ChatBodyPart[] {
  const parts: ChatBodyPart[] = [];
  let last = 0;
  for (const match of body.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(...splitBareUrls(body.slice(last, index)));
    parts.push({ type: "link", text: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < body.length) parts.push(...splitBareUrls(body.slice(last)));
  return parts;
}

/** "[free trial](https://…/trial)" → "free trial (https://…/trial)", for channels that can't show a link. */
export function chatBodyToPlainText(body: string): string {
  return body.replace(LINK_RE, "$1 ($2)");
}

/** The phrase in a coach's draft that offers to become a link to the booking form. */
export const TRIAL_PHRASE_RE = /\bfree trial\b/i;

/** "free trial" in a draft outside any link — one already inside a link (the + menu's "Book a free trial") isn't offered again. */
export function hasUnlinkedTrialPhrase(body: string): boolean {
  return parseChatBody(body).some((part) => part.type === "text" && TRIAL_PHRASE_RE.test(part.text));
}

/**
 * Turns every "free trial" in a draft into a link to the booking form,
 * keeping the coach's capitalisation and leaving any already-written link
 * alone.
 */
export function linkTrialPhrase(body: string, trialUrl: string): string {
  return parseChatBody(body)
    .map((part) =>
      part.type === "link"
        ? // A pasted address stays exactly as it was typed.
          part.href === part.text || part.href === `https://${part.text}`
          ? part.text
          : `[${part.text}](${part.href})`
        : part.text.replace(/\bfree trial\b/gi, (phrase) => `[${phrase}](${trialUrl})`),
    )
    .join("");
}
