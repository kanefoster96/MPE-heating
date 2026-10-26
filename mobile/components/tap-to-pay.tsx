import type { ReactNode } from "react";

/**
 * Tap to Pay where the Stripe Terminal SDK can't run (the web preview).
 * The real one is tap-to-pay.native.tsx.
 */
export const tapToPayBuilt = false;

export function TapToPayProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export type TapResult = { ok: true } | { ok: false; cancelled?: boolean; message: string };

export function useTapToPay(_locationId: string | null) {
  return {
    supported: false,
    take: async (_paymentRequestId: string): Promise<TapResult> => ({ ok: false, message: "Tap to Pay works in the MPE app on a phone." }),
  };
}
