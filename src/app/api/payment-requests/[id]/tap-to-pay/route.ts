import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { paymentsOn, tapToPayIntent } from "@/lib/payments";

/** Tap to Pay in the MPE app, or a Bluetooth card reader (`{ reader: "bluetooth" }`): the card-present payment the app collects. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer?.staff) return NextResponse.json({ error: "Only the team can do that." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { reader?: unknown };
  const result = await tapToPayIntent(id, body.reader === "bluetooth" ? "card_reader" : "tap_to_pay");
  return "clientSecret" in result ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}
