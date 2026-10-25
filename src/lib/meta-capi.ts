import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { CONSENT_COOKIE_NAME, CONSENT_GRANTED } from "@/lib/cookie-consent";

// The server half of Meta advert measurement (the Conversions API), from
// Kanvas Academy. Catches the conversions the browser pixel misses (Safari's
// tracking limits, ad blockers); Meta dedupes the two copies by event id.

const GRAPH_API_VERSION = "v21.0";

/** Meta wants personal details (email, phone) as trimmed, lowercased SHA-256. */
function hashForMeta(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Whether this visitor accepted the cookie banner. Read fresh from the request. */
async function hasConsent(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(CONSENT_COOKIE_NAME)?.value === CONSENT_GRANTED;
}

/**
 * The visitor's Meta ad-click ids, kept on the enquiry so the job can be
 * tied back to the advert later: `_fbc` (from the ?fbclid= on the advert's
 * link) and `_fbp` (the pixel's browser id). Empty without cookie consent,
 * or with no pixel set up, so nothing is kept for anyone who declined.
 * The keys match the Academy's, so its later-event code ports over as is.
 */
export async function captureMetaClickIds(): Promise<Record<string, string>> {
  if (!process.env.NEXT_PUBLIC_META_PIXEL_ID) return {};
  try {
    if (!(await hasConsent())) return {};
    const cookieStore = await cookies();
    const entries = {
      meta_fbc: cookieStore.get("_fbc")?.value?.slice(0, 500),
      meta_fbp: cookieStore.get("_fbp")?.value?.slice(0, 500),
    };
    return Object.fromEntries(Object.entries(entries).filter((e): e is [string, string] => !!e[1]));
  } catch {
    // Never let ad tracking stop a booking.
    return {};
  }
}

type SendMetaConversionEventInput = {
  eventName: string;
  /** The eventId given to lib/meta-pixel.ts's trackMetaEvent for the same action, so Meta counts it once. */
  eventId?: string;
  email?: string;
  /**
   * E.164 (see lib/phone.ts). Sent hashed alongside the email, because Meta
   * matches a conversion to whoever saw the advert on what it's given, and
   * the mobile on someone's Facebook profile often matches where an email
   * doesn't. An unmatched conversion gives the advert no credit.
   */
  phone?: string;
  /** Our own id for this person or job, sent hashed. */
  externalId?: string;
  /** content_name and the like. */
  customData?: Record<string, unknown>;
};

/**
 * Sends one event to Meta's Conversions API. Does nothing unless
 * NEXT_PUBLIC_META_PIXEL_ID and META_CONVERSIONS_API_ACCESS_TOKEN are both
 * set and the visitor accepted the cookie banner, and never throws: broken
 * ad tracking must never stop a real booking. META_TEST_EVENT_CODE (Events
 * Manager → Test events) sends events to Meta's test view instead of
 * counting them, for while it's being set up.
 *
 * Consent is needed even though this sets no cookies, because it shares
 * hashed personal details with Meta for ad matching.
 */
export async function sendMetaConversionEvent({ eventName, eventId, email, phone, externalId, customData }: SendMetaConversionEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    if (!(await hasConsent())) return;
    const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);

    const userData: Record<string, unknown> = {
      client_ip_address: headersList.get("x-forwarded-for")?.split(",")[0]?.trim(),
      client_user_agent: headersList.get("user-agent") ?? undefined,
      fbp: cookieStore.get("_fbp")?.value,
      fbc: cookieStore.get("_fbc")?.value,
    };
    if (email) userData.em = [hashForMeta(email)];
    // Digits only before hashing (no "+", no spaces): a number hashed in
    // any other shape never matches anyone.
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits) userData.ph = [hashForMeta(digits)];
    }
    if (externalId) userData.external_id = [hashForMeta(externalId)];
    // Customers are local, so the country is theirs: one more thing to
    // match on, and it rules out namesakes abroad.
    if (email || phone) userData.country = [hashForMeta("gb")];

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          // The page the form was on (the fetch's referer), never a private one.
          event_source_url: headersList.get("referer") ?? undefined,
          action_source: "website",
          user_data: userData,
          ...(customData ? { custom_data: customData } : {}),
        },
      ],
      ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
    };

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // The booking waits on this, so a slow Meta mustn't hold it up for long.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("sendMetaConversionEvent failed", res.status, await res.text());
  } catch (err) {
    console.error("sendMetaConversionEvent failed", err);
  }
}
