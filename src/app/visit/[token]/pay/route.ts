import { NextResponse } from "next/server";
import { CLUB_SITE_URL } from "@/lib/club";
import { startCalloutPrepay } from "@/lib/callout-prepay";

/** "Pay your £50 call-out now" (lib/callout-prepay.ts): on to the pay page, or back to the visit if there's nothing to pay. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = CLUB_SITE_URL.replace(/\/$/, "");
  const url = /^[A-Za-z0-9_-]{8,}$/.test(token) ? await startCalloutPrepay(token).catch(() => null) : null;
  return NextResponse.redirect(url ?? `${site}/visit/${encodeURIComponent(token)}`, 303);
}
