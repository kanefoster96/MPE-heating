/**
 * Where this visit came from, captured once on the landing page and held
 * while the tab is open (Kanvas Academy's lib/first-touch.ts).
 *
 * The booking form reads it from here rather than from the address bar,
 * because by the time someone reaches the contact step the ?utm_ and
 * ?fbclid= on the advert's link are long gone: they landed on
 * /boiler-repair?utm_source=facebook and tapped through to /emergency.
 *
 * Deliberately a variable in memory, not a cookie or local storage: nothing
 * is written to the visitor's device, so it needs no consent and works for
 * people who declined it too. A booking form is something they chose to
 * send us, and knowing which advert or link brought them is a legitimate
 * interest. The trade is that it only lives as long as the page's
 * JavaScript, which is why it's saved on the enquiry at the moment of
 * sending rather than looked up later.
 */

type FirstTouch = { referrer: string; search: string };

let firstTouch: FirstTouch | null = null;

/** The referrer, unless it's this site: a reload or a new tab isn't where they came from. */
function outsideReferrer(): string {
  try {
    return document.referrer && new URL(document.referrer).origin !== window.location.origin ? document.referrer : "";
  } catch {
    return "";
  }
}

/**
 * Records the referrer and query string, the first time only. Called from
 * components/MetaPixel.tsx as its module loads, which is in the root layout
 * and so happens on the landing page. Does nothing on the server.
 */
export function captureFirstTouch(): void {
  if (firstTouch || typeof window === "undefined") return;
  firstTouch = { referrer: outsideReferrer(), search: window.location.search };
}

/** The captured first touch, or the page as it is now if nothing was captured. */
export function getFirstTouch(): FirstTouch {
  if (firstTouch) return firstTouch;
  if (typeof window === "undefined") return { referrer: "", search: "" };
  return { referrer: outsideReferrer(), search: window.location.search };
}
