import { useCallback, useRef, type ReactNode } from "react";
import { NativeModules, Platform } from "react-native";
import { StripeTerminalProvider, requestNeededAndroidPermissions, useStripeTerminal } from "@stripe/stripe-terminal-react-native";
import { apiPost } from "@/lib/api";

/**
 * Tap to Pay on Fergal's phone (Stripe Terminal): the customer taps their
 * card or phone on the back of his, and the invoice is paid. The site
 * makes the payment (/api/payment-requests/[id]/tap-to-pay) and marks it
 * paid from Stripe's webhook, like any other.
 *
 * Only in a real build of the app with the Stripe Terminal SDK in it, and
 * on iPhone only once Apple has granted MPE's developer account the Tap to
 * Pay entitlement (app.config.js adds it when TAP_TO_PAY_ENTITLEMENT=1).
 * Expo Go and the web preview get tap-to-pay.tsx instead, which says it
 * isn't available.
 */

/** Whether this build has the Stripe Terminal SDK in it at all. */
export const tapToPayBuilt = !!NativeModules.StripeTerminalReactNative;

const SIMULATED = process.env.EXPO_PUBLIC_TAP_TO_PAY_SIMULATED === "1";

async function connectionToken(): Promise<string> {
  const { secret } = await apiPost<{ secret: string }>("/api/terminal/connection-token");
  return secret;
}

export function TapToPayProvider({ children }: { children: ReactNode }) {
  if (!tapToPayBuilt) return <>{children}</>;
  return (
    <StripeTerminalProvider tokenProvider={connectionToken} logLevel="error">
      <>{children}</>
    </StripeTerminalProvider>
  );
}

export type TapResult = { ok: true } | { ok: false; cancelled?: boolean; message: string };

/** take(paymentRequestId): connects the phone as the reader the first time, then collects the payment. */
export function useTapToPay(locationId: string | null) {
  const terminal = useStripeTerminal();
  const ready = useRef(false);

  const take = useCallback(
    async (paymentRequestId: string): Promise<TapResult> => {
      if (!tapToPayBuilt) return { ok: false, message: "Tap to Pay needs the full MPE app, not a preview." };
      if (!locationId) return { ok: false, message: "Tap to Pay isn't set up yet: STRIPE_TERMINAL_LOCATION is missing on the website." };
      if (Platform.OS === "android") {
        const denied = await requestNeededAndroidPermissions().catch(() => null);
        if (denied) return { ok: false, message: "Tap to Pay needs location permission on Android." };
      }
      if (!ready.current) {
        const init = await terminal.initialize();
        if (init.error) return { ok: false, message: init.error.message };
        ready.current = true;
      }
      if (!terminal.connectedReader) {
        const connected = await terminal.easyConnect({
          discoveryMethod: "tapToPay",
          locationId,
          simulated: SIMULATED,
          merchantDisplayName: "MPE",
          tosAcceptancePermitted: true,
          autoReconnectOnUnexpectedDisconnect: true,
        });
        if (connected.error) return { ok: false, message: connected.error.message };
      }
      let clientSecret: string;
      try {
        clientSecret = (await apiPost<{ clientSecret: string }>(`/api/payment-requests/${paymentRequestId}/tap-to-pay`)).clientSecret;
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Couldn't start the payment." };
      }
      const retrieved = await terminal.retrievePaymentIntent(clientSecret);
      if (retrieved.error) return { ok: false, message: retrieved.error.message };
      const processed = await terminal.processPaymentIntent({ paymentIntent: retrieved.paymentIntent });
      if (processed.error) {
        const cancelled = /cancel/i.test(String(processed.error.code));
        return { ok: false, cancelled, message: cancelled ? "Payment cancelled." : processed.error.message };
      }
      return { ok: true };
    },
    [terminal, locationId],
  );

  return { take, supported: tapToPayBuilt };
}
