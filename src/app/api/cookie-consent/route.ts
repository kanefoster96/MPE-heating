import { NextResponse, type NextRequest } from "next/server";
import { CONSENT_COOKIE_DAYS, CONSENT_COOKIE_NAME, CONSENT_DENIED, CONSENT_GRANTED } from "@/lib/cookie-consent";

/**
 * The cookie banner without JavaScript (Kanvas Academy): a tap on Accept or
 * Decline before the page's script is running posts here. Records the
 * answer the same way the banner does, then sends them back to the page
 * they were on, address bar and all, so an advert's ?fbclid= is still there
 * when the pixel loads.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const value = form?.get("choice") === CONSENT_GRANTED ? CONSENT_GRANTED : CONSENT_DENIED;

  // Back to the page they were on, but only ever on this site.
  let back = new URL("/", request.url);
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === back.origin) back = url;
    } catch {
      // A malformed referer: the homepage it is.
    }
  }

  const response = NextResponse.redirect(back, 303);
  // Readable by the page's own script (not httpOnly), as the banner sets it.
  response.cookies.set(CONSENT_COOKIE_NAME, value, { path: "/", maxAge: CONSENT_COOKIE_DAYS * 24 * 60 * 60, sameSite: "lax" });
  return response;
}
