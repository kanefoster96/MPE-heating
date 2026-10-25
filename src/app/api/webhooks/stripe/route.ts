import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, CONNECT_ACCOUNT } from "@/lib/stripe";
import { handlePaymentIntent } from "@/lib/payments";
import { getPlanMember, openPlan, planPaymentFailed, syncPlanSubscription } from "@/lib/maintenance-plan";
import { handleCardSetup, handleInstalmentIntent } from "@/lib/instalments";

/**
 * Stripe's webhook (Kanvas Academy's, for MPE's payments). Three kinds:
 *  - a call-out fee or invoice paid in one go, however it was paid
 *    (payment_intent.succeeded);
 *  - the maintenance plan, a Stripe subscription (metadata kind "plan");
 *  - an invoice paid monthly: its first payment, each month's, and any
 *    paid off (payment intent metadata "instalment"), and a new card for
 *    it (a setup Checkout, metadata kind "instalments_card").
 * Every handler is safe to repeat, so a redelivered event changes nothing;
 * a failure answers 500 so Stripe tries again.
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
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (!(await handleInstalmentIntent(intent))) await handlePaymentIntent(intent);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup" && session.metadata?.kind === "instalments_card") {
          await handleCardSetup(session);
          break;
        }
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (session.mode !== "subscription" || !subscriptionId) break;
        if (session.metadata?.kind === "plan" && session.metadata.plan_member_id) await openPlan(session.metadata.plan_member_id, subscriptionId);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const details = invoice.parent?.subscription_details;
        const subscriptionId = typeof details?.subscription === "string" ? details.subscription : details?.subscription?.id;
        const meta = details?.metadata ?? {};
        if (!subscriptionId) break;
        if (meta.kind === "plan" && meta.plan_member_id) {
          if (event.type === "invoice.payment_failed") {
            await planPaymentFailed(meta.plan_member_id, invoice);
          } else if ((await getPlanMember(meta.plan_member_id))?.status === "pending") {
            // Its first payment, ahead of Checkout's own event.
            await openPlan(meta.plan_member_id, subscriptionId);
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.kind === "plan") await syncPlanSubscription(sub);
        break;
      }
    }
  } catch (err) {
    console.error("stripe webhook failed", event.id, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
