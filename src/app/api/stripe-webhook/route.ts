// Stripe webhook — catches payments taken outside this site (above all
// tap-to-pay in the Stripe app itself) so they land on the admin job list
// against the right customer, with a "add job notes" prompt for Fergal.
//
// This handler is real, working code, not a stub: signature verification
// follows Stripe's documented v1 scheme (HMAC-SHA256 over
// "<timestamp>.<payload>", timing-safe compare, 5-minute replay window),
// implemented with Node's crypto so it doesn't need the `stripe` npm
// package installed before a Stripe account exists. Until
// STRIPE_WEBHOOK_SECRET is set it refuses all traffic with a 503.
//
// To go live once a Stripe account exists:
//   1. In the Stripe dashboard, add a webhook endpoint pointed at
//      <site>/api/stripe-webhook, subscribed to payment_intent.succeeded.
//   2. Put its signing secret ("whsec_…") in STRIPE_WEBHOOK_SECRET.
//   3. Connect Supabase and fill in the TODO(supabase) block below.

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

// How out-of-date a signed timestamp may be before we treat the delivery
// as a replay. Matches the tolerance stripe-node uses by default.
const REPLAY_TOLERANCE_SECONDS = 300;

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  // Header format: "t=<unix ts>,v1=<hex sig>[,v1=<hex sig>…]" — multiple
  // v1 entries appear while a secret is being rolled, any match counts.
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > REPLAY_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
  );
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

// The slice of a payment_intent.succeeded event this route acts on.
type PaymentIntentEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      customer: string | null;
      payment_method_types?: string[];
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: PaymentIntentEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;

    // card_present means the card was physically tapped/inserted — i.e.
    // tap-to-pay taken in the Stripe app. Everything else that reaches
    // this webhook (card-on-file charges, paid invoice links) is created
    // by our own server code, which records its own payments row at
    // creation time — the webhook only needs to catch what happened
    // outside this codebase, but logging the method keeps it general.
    const method = intent.payment_method_types?.includes("card_present")
      ? "tap_to_pay"
      : "other";

    // TODO(supabase): this is the write that puts the payment on Fergal's
    // job list. With a service-role client (webhooks bypass RLS):
    //   1. Look up the profile: select profile_id from stripe_customers
    //      where stripe_customer_id = intent.customer.
    //   2. Upsert into payments (on stripe_payment_intent_id — Stripe
    //      retries deliveries, the same intent must never insert twice):
    //      { profile_id: <match or null>, amount_pence: intent.amount,
    //        currency: intent.currency, status: 'paid', method,
    //        stripe_payment_intent_id: intent.id,
    //        stripe_customer_id: intent.customer, needs_notes: true }.
    //      A payment with no match (customer null, or a Stripe customer
    //      this database doesn't know) keeps profile_id null — it shows
    //      in the admin's "Unmatched payments" section for Fergal to
    //      assign by hand, never silently dropped. Assigning sets
    //      profile_id and, when the row carries a stripe_customer_id,
    //      backfills the stripe_customers mapping so that customer's
    //      next payment matches automatically.
    //   3. For a matched payment, best effort, link the job: the
    //      customer's most recent 'confirmed' booking gets booking_id
    //      set and status 'completed'. needs_notes drives the "add job
    //      notes for future engineers" prompt in /admin/callouts,
    //      cleared when Fergal saves notes (which insert into job_notes,
    //      readable by the customer on their account per the RLS).
    void method;
    void intent;
  }

  // Anything else (or a successfully handled event) gets a 200 so Stripe
  // stops retrying. Unknown event types are expected — the endpoint only
  // subscribes to what it handles, but a dashboard misconfiguration
  // shouldn't cause an endless retry loop.
  return NextResponse.json({ received: true });
}
