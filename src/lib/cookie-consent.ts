/**
 * A single on/off switch for advert tracking (the Meta Pixel and its
 * Conversions API copy, lib/meta-pixel.ts and lib/meta-capi.ts), from
 * Kanvas Academy. Shared between the browser (the banner, the pixel) and
 * the server (the booking form's Lead event), so it has to be a real cookie
 * rather than localStorage. The cookie itself needs no consent: remembering
 * someone's choice is strictly necessary, not marketing.
 *
 * Nothing reads it until NEXT_PUBLIC_META_PIXEL_ID is set; until then there
 * is no banner and nothing to consent to.
 */
export const CONSENT_COOKIE_NAME = "mpe_consent";
export const CONSENT_GRANTED = "granted";
export const CONSENT_DENIED = "denied";
export const CONSENT_COOKIE_DAYS = 365;

/**
 * Dispatched on `window` the moment someone answers the banner, so the
 * pixel can start (and the banner go) without a page reload.
 */
export const CONSENT_CHANGED_EVENT = "mpe-consent-changed";

/**
 * Added to <html> before first paint when the consent cookie is there
 * (see app/layout.tsx), so the banner, which is in the page's HTML for
 * everyone, never flashes up for someone who has already answered.
 */
export const CONSENT_SET_CLASS = "consent-set";

/** The visitor's answer, in the browser: granted, denied, or null if they haven't said. */
export function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const row = document.cookie.split("; ").find((r) => r.startsWith(`${CONSENT_COOKIE_NAME}=`));
  return row ? row.slice(CONSENT_COOKIE_NAME.length + 1) : null;
}
