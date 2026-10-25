import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { paymentsOn, tapToPayIntent } from "@/lib/payments";

/** Tap to Pay in the MPE app: the card-present payment the app collects on the phone. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer?.staff) return NextResponse.json({ error: "Only the team can do that." }, { status: 403 });
  const result = await tapToPayIntent(id);
  return "clientSecret" in result ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}
