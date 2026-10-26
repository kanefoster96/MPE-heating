import { useCallback, useRef, type ReactNode } from "react";
import { NativeModules, Platform } from "react-native";
import { StripeTerminalProvider, requestNeededAndroidPermissions, useStripeTerminal, type Reader } from "@stripe/stripe-terminal-react-native";
import { apiPost } from "@/lib/api";

/**
 * Tap to Pay on Fergal's phone (Stripe Terminal): the customer taps their
 * card or phone on the back of his, and the invoice is paid. Or a
 * Bluetooth card reader (a Stripe M2 or WisePad 3, registered to MPE's
 * Stripe location): the first one switched on nearby is used. The site
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
export type TapWith = "phone" | "reader";

const READER_SEARCH_MS = 20_000;

/** take(paymentRequestId, with): connects the phone (or a Bluetooth reader) the first time, then collects the payment. */
export function useTapToPay(locationId: string | null) {
  const found = useRef<((readers: Reader.Type[]) => void) | null>(null);
  const terminal = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => found.current?.(readers),
  });
  const ready = useRef(false);
  const using = useRef<TapWith | null>(null);

  /** The first Bluetooth reader switched on nearby, or null after a while. */
  const findReader = useCallback(async (): Promise<Reader.Type | null> => {
    const first = new Promise<Reader.Type | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), READER_SEARCH_MS);
      found.current = (readers) => {
        if (!readers.length) return;
        clearTimeout(timer);
        resolve(readers[0]);
      };
    });
    terminal.discoverReaders({ discoveryMethod: "bluetoothScan", simulated: SIMULATED }).catch(() => null);
    const reader = await first;
    found.current = null;
    await terminal.cancelDiscovering().catch(() => null);
    return reader;
  }, [terminal]);

  const take = useCallback(
    async (paymentRequestId: string, how: TapWith = "phone"): Promise<TapResult> => {
      if (!tapToPayBuilt) return { ok: false, message: "Card payments need the full MPE app, not a preview." };
      if (!locationId) return { ok: false, message: "Card payments aren't set up yet: STRIPE_TERMINAL_LOCATION is missing on the website." };
      if (Platform.OS === "android") {
        const denied = await requestNeededAndroidPermissions().catch(() => null);
        if (denied) return { ok: false, message: "Card payments need location and Bluetooth permission on Android." };
      }
      if (!ready.current) {
        const init = await terminal.initialize();
        if (init.error) return { ok: false, message: init.error.message };
        ready.current = true;
      }
      // The other one's connected: swap.
      if (terminal.connectedReader && using.current !== how) {
        await terminal.disconnectReader().catch(() => null);
      }
      if (!terminal.connectedReader || using.current !== how) {
        if (how === "phone") {
          const connected = await terminal.easyConnect({
            discoveryMethod: "tapToPay",
            locationId,
            simulated: SIMULATED,
            merchantDisplayName: "MPE",
            tosAcceptancePermitted: true,
            autoReconnectOnUnexpectedDisconnect: true,
          });
          if (connected.error) return { ok: false, message: connected.error.message };
        } else {
          const reader = await findReader();
          if (!reader) return { ok: false, message: "No card reader found. Switch it on, keep it near your phone, and try again." };
          const connected = await terminal.connectReader({ discoveryMethod: "bluetoothScan", reader, locationId, autoReconnectOnUnexpectedDisconnect: true });
          if (connected.error) return { ok: false, message: connected.error.message };
        }
        using.current = how;
      }
      let clientSecret: string;
      try {
        clientSecret = (await apiPost<{ clientSecret: string }>(`/api/payment-requests/${paymentRequestId}/tap-to-pay`, { reader: how === "reader" ? "bluetooth" : "phone" })).clientSecret;
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
    [terminal, locationId, findReader],
  );

  return { take, supported: tapToPayBuilt };
}
