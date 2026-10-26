import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { QUOTE_TABS, quoteList, type QuoteTab } from "@/lib/app-quotes";

/** The app's quotes: waiting for them, accepted, or the last 90 days (`?show=`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const show = new URL(request.url).searchParams.get("show");
  return mobileJson(await quoteList(QUOTE_TABS.includes(show as QuoteTab) ? (show as QuoteTab) : "open"));
}
