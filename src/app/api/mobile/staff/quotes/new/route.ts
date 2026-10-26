import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { quoteContext, sendNewQuote, type QuoteBody } from "@/lib/app-quotes";

/** What the app's new quote screen needs, for a visit (`?visit=`) or a customer (`?customer=`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const q = new URL(request.url).searchParams;
  const context = await quoteContext({ visitId: q.get("visit"), customerId: q.get("customer") });
  return context ? mobileJson(context) : mobileJson({ error: "Pick the customer first." }, 404);
}

/** Writes the quote and sends it (lib/app-quotes.ts). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const result = await sendNewQuote(await readJson<QuoteBody>(request), caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
