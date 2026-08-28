import { NextRequest, NextResponse } from "next/server";

// Looks up every address at a UK postcode via Ideal Postcodes
// (https://ideal-postcodes.co.uk), which resells Royal Mail's licensed
// address data (PAF) over a REST API — there's no free way to do this
// otherwise. To go live:
//   1. Sign up at ideal-postcodes.co.uk and grab an API key.
//   2. Set IDEAL_POSTCODES_API_KEY in your environment (in Vercel:
//      Project Settings -> Environment Variables). Never expose it to the
//      client — that's why this lives in a server route instead of being
//      called directly from AddressFinder.
//
// Outside production, this falls back to Ideal Postcodes' public "ak_test"
// key so address lookup works locally with zero setup. That key is shared
// globally by every developer testing their API, capped at 5 lookups/day,
// and Ideal Postcodes explicitly document it as breaking in production —
// so it's dev-only and never used when NODE_ENV is "production".
//
// Not done yet: this has no rate limiting of its own, so a real API key
// here is spend-at-risk if the endpoint gets hammered. Worth adding before
// high traffic — e.g. Vercel's built-in rate limiting, or a simple
// IP/window limiter — and/or caching repeat postcode lookups.
const DEV_TEST_KEY = "ak_test";

type IdealPostcodesResult = {
  line_1?: string;
  line_2?: string;
  line_3?: string;
  post_town?: string;
  postcode?: string;
};

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode")?.trim();

  if (!postcode) {
    return NextResponse.json({ error: "Missing postcode" }, { status: 400 });
  }

  const apiKey =
    process.env.IDEAL_POSTCODES_API_KEY ??
    (process.env.NODE_ENV !== "production" ? DEV_TEST_KEY : null);

  if (!apiKey) {
    return NextResponse.json({ addresses: [], configured: false, unavailable: false });
  }

  try {
    const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(
      postcode
    )}?api_key=${apiKey}`;
    const response = await fetch(url);

    // 402 covers both "key balance depleted" (out of credits) and "lookup
    // limit reached" (rate limit — this is exactly what happens once the
    // shared dev ak_test key hits its 5/day cap). Either way it's not the
    // postcode's fault, so the UI should say so rather than imply nothing
    // was found there.
    if (response.status === 402) {
      return NextResponse.json({ addresses: [], configured: true, unavailable: true });
    }

    const data = await response.json();

    if (!response.ok || !Array.isArray(data?.result)) {
      return NextResponse.json({ addresses: [], configured: true, unavailable: false });
    }

    const addresses = (data.result as IdealPostcodesResult[])
      .map((r) => [r.line_1, r.line_2, r.line_3, r.post_town, r.postcode].filter(Boolean).join(", "))
      .filter(Boolean);

    return NextResponse.json({ addresses, configured: true, unavailable: false });
  } catch {
    return NextResponse.json({ addresses: [], configured: true, unavailable: false });
  }
}
