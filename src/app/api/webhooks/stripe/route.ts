import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, CONNECT_ACCOUNT } from "@/lib/stripe";
import { handlePaymentIntent } from "@/lib/payments";

/**
 * Stripe's webhook (Kanvas Academy's, for MPE's one kind of payment): a
 * payment for a call-out fee or an invoice went through, however it was
 * paid. Marking it paid is safe to repeat, so a redelivered event changes
 * nothing; a failure answers 500 so Stripe tries again.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid payload" }, { status: 400 });
  }
  // On Kanvas One's Connect webhook, only MPE's own account's events are ours.
  if ((event.account ?? null) !== CONNECT_ACCOUNT) return NextResponse.json({ received: true, ignored: "another account" });

  try {
    if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntent(event.data.object as Stripe.PaymentIntent);
    }
  } catch (err) {
    console.error("stripe webhook failed", event.id, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
