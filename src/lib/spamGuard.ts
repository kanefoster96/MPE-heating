// Ported from Kanvas Academy (src/lib/spam-guard.ts).
/**
 * Cheap, quiet checks for bot submissions on public forms.
 *
 * Bots fill every field they find, submit in a blink, and (the ones we
 * actually get) type random strings like "BahhUlModFVNDLffNiKPB". None of
 * these checks bothers a real parent: the honeypot is invisible, nobody
 * writes a question in under three seconds, and real names and questions
 * have spaces or ordinary capitals in them.
 */

/** The hidden field's name. Real people never see it, so it stays empty. */
export const HONEYPOT_FIELD = "website";

/** Faster than this from page load to submit is not a person typing. */
const MIN_FILL_MS = 3_000;

/**
 * One unbroken run of letters with capitals scattered through it, e.g.
 * "XetPzPIABTrlUSRK". A real name ("Sarah", "McDonald") or a short real
 * question has at most a couple of capitals and usually a space.
 */
function looksRandom(value: string): boolean {
  const v = value.trim();
  if (v.length < 8 || /\s/.test(v) || !/^[A-Za-z]+$/.test(v)) return false;
  const innerCapitals = (v.slice(1).match(/[A-Z]/g) ?? []).length;
  return innerCapitals >= 3;
}

export function isLikelyBot(params: {
  honeypot?: string | null;
  /** Date.now() when the form was first shown, sent with the submission. */
  startedAt?: number | null;
  /** The free-text fields a person typed. All random = a bot. */
  textFields: string[];
}): boolean {
  if (params.honeypot && params.honeypot.trim()) return true;
  if (!params.startedAt || !Number.isFinite(params.startedAt)) return true;
  const elapsed = Date.now() - params.startedAt;
  if (elapsed < MIN_FILL_MS || elapsed > 1000 * 60 * 60 * 24) return true;
  const fields = params.textFields.filter((f) => f.trim());
  return fields.length > 0 && fields.every(looksRandom);
}

/** The hidden field a FormData form sends its fill time in (see BotCheckFields). */
export const FILL_MS_FIELD = "fillMs";

/**
 * What a website form sends for the checks above: the honeypot, and how
 * long the form had been open when it was sent, measured in the browser.
 *
 * A length of time rather than the moment it opened, like the app sends:
 * the browser's clock against ours would make a parent whose computer is a
 * few minutes out look like a bot.
 */
export type BotCheckFields = {
  website?: string;
  fillMs?: number;
};

/** isLikelyBot for a website form's BotCheckFields. */
export function isLikelyBotSubmission(fields: BotCheckFields, textFields: string[]): boolean {
  const fillMs = typeof fields.fillMs === "number" && Number.isFinite(fields.fillMs) ? fields.fillMs : null;
  return isLikelyBot({
    honeypot: typeof fields.website === "string" ? fields.website : null,
    // Only too-fast counts against a website form. A parent who opens the
    // trial page from an ad tonight and books in the morning is still a
    // parent, so a long wait is capped under isLikelyBot's one-day limit.
    startedAt: fillMs === null ? null : Date.now() - Math.min(fillMs, 12 * 60 * 60 * 1000),
    textFields,
  });
}

/** Makes typed text safe to drop into an HTML email. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
