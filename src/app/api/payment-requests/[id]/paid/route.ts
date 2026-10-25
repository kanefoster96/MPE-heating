import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { markPaidInPerson, paymentsOn } from "@/lib/payments";

/** Paid with the team another way: another card machine, cash or bank transfer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer?.staff) return NextResponse.json({ error: "Only the team can do that." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { via?: unknown };
  const via = body.via === "cash" || body.via === "bank_transfer" ? body.via : "in_person";
  const result = await markPaidInPerson(id, via);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}
