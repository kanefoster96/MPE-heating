import { NextResponse } from "next/server";
import { requestViewer } from "@/lib/payment-viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentRequest, payLink, paymentsOn, savedCardFor } from "@/lib/payments";

/** A payment request as the chat card shows it: the team can manage it; its customer can pay it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!paymentsOn()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const viewer = await requestViewer(request);
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const p = await getPaymentRequest(id);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let isCustomer = false;
  if (!viewer.staff && p.conversationId) {
    const { data } = await createAdminClient().from("chat_conversations").select("user_id").eq("id", p.conversationId).maybeSingle();
    isCustomer = data?.user_id === viewer.user.id;
  }
  if (!viewer.staff && !isCustomer) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const card = viewer.staff && p.status === "open" && p.customerId && new URL(request.url).searchParams.get("card") === "1" ? await savedCardFor({ id: p.customerId }) : null;
  return NextResponse.json({
    request: {
      id: p.id,
      kind: p.kind,
      number: p.number,
      description: p.description,
      amountPence: p.amountPence,
      status: p.status,
      paidAt: p.paidAt,
      paidVia: p.paidVia,
      payUrl: payLink(p),
      canPay: p.status === "open",
      canManage: viewer.staff,
      ...(card !== null || viewer.staff ? { savedCard: card ? { brand: card.brand, last4: card.last4 } : null } : {}),
    },
  });
}
