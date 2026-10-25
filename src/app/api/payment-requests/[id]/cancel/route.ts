import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { cancelPaymentRequest, paymentsOn } from "@/lib/payments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer?.staff) return NextResponse.json({ error: "Only the team can do that." }, { status: 403 });
  const result = await cancelPaymentRequest(id);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}
