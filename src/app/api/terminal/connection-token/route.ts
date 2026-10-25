import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { paymentsOn, terminalConnectionToken } from "@/lib/payments";

/** The MPE app's Stripe Terminal SDK asks for this before Tap to Pay. Team only. */
export async function POST(request: Request) {
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer?.staff) return NextResponse.json({ error: "Only the team can do that." }, { status: 403 });
  return NextResponse.json({ secret: await terminalConnectionToken() });
}
