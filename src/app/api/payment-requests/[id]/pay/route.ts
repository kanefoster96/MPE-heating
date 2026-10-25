import { NextResponse } from "next/server";
import { checkoutUrl, getPaymentRequest, paymentsOn } from "@/lib/payments";

/** Stripe Checkout for a payment: from the chat card, or the pay page. Anyone with it may pay it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { saveCard?: unknown };
  if (!(await getPaymentRequest(id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const result = await checkoutUrl(id, { saveCard: body.saveCard === true });
  return "url" in result ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}
