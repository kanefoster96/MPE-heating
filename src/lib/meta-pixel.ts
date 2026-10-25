// The browser half of Meta (Facebook/Instagram) advert measurement, from
// Kanvas Academy. Off until NEXT_PUBLIC_META_PIXEL_ID is set, and even then
// only for someone who has accepted the cookie banner
// (components/CookieConsentBanner.tsx): nothing loads from Meta otherwise.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  /** Stops the pixel sending its own PageView on every client-side page change; components/MetaPixel.tsx sends them instead, so it can skip the private pages. */
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/**
 * Pages the pixel never runs on. A customer's visit, payment, plan and
 * pick-a-time pages carry a private token in the address, and PageView
 * sends Meta the full address; the rest are logins and the signed-in
 * areas, which are nobody's advert journey.
 */
const PRIVATE_PREFIXES = ["/visit", "/pay", "/plan", "/request", "/auth", "/account", "/staff", "/login", "/messages"];

export function isPrivatePath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Fires a browser-side pixel event. A no-op if the pixel hasn't loaded (no
 * pixel id, no consent, blocked, or a private page), so callers needn't
 * check. Pass the same eventId as the matching lib/meta-capi.ts call so
 * Meta counts the browser and server copies as one.
 */
export function trackMetaEvent(eventName: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq || isPrivatePath(window.location.pathname)) return;
  window.fbq("track", eventName, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

/** An id for one event, shared by its browser and server copies. randomUUID is missing on plain http (testing on a phone over the LAN), hence the fallback. */
export function newMetaEventId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Meta's standard pixel snippet, written out. Safe to call more than once;
 * it does nothing once fbq exists. Sends no PageView itself: the caller
 * does, once it knows the page isn't a private one.
 */
export function loadMetaPixel() {
  if (typeof window === "undefined" || !META_PIXEL_ID || window.fbq) return;

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", META_PIXEL_ID);
}
