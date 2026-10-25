import Stripe from "stripe";

/**
 * Only import this from server actions / route handlers that actually call
 * Stripe (checkout, webhooks) — not from page components — so pages that
 * just need plan metadata (see ./plans) can still render before
 * STRIPE_SECRET_KEY is configured.
 *
 * A One club's money is in its own Stripe account, connected to Kanvas
 * One's. Then STRIPE_SECRET_KEY is the Kanvas One key and
 * STRIPE_CONNECT_ACCOUNT the club's account (acct_...): every call below is
 * made in the club's account, so parents pay the club and the club's name
 * is on their statement. Unset (Kanvas Academy, or any club with a Stripe
 * account of its own), nothing changes.
 */
export const CONNECT_ACCOUNT = process.env.STRIPE_CONNECT_ACCOUNT || null;

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_placeholder",
  CONNECT_ACCOUNT ? { stripeAccount: CONNECT_ACCOUNT } : undefined,
);

/**
 * Kanvas One's cut of each payment a connected club takes, as a percentage
 * (PLATFORM_FEE_PERCENT). 0, or unset, takes nothing; it only ever applies
 * to a connected club. Spread these into the create calls, so a fee of 0
 * sends nothing at all.
 */
const FEE_PERCENT = CONNECT_ACCOUNT
  ? Math.min(Math.max(Number(process.env.PLATFORM_FEE_PERCENT) || 0, 0), 20)
  : 0;

/** For a subscription, or a Checkout session's subscription_data. */
export function subscriptionFee(): { application_fee_percent?: number } {
  return FEE_PERCENT > 0 ? { application_fee_percent: FEE_PERCENT } : {};
}

/** For a one-off payment of `amount` pence: a PaymentIntent, or a Checkout session's payment_intent_data. */
export function paymentFee(amount: number | null | undefined): { application_fee_amount?: number } {
  if (!(FEE_PERCENT > 0) || !amount || amount <= 0) return {};
  const fee = Math.round((amount * FEE_PERCENT) / 100);
  return fee > 0 ? { application_fee_amount: fee } : {};
}
