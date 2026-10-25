"use client";

import { Fragment } from "react";

// Ported from Kanvas Academy (src/components/wizard-step-indicator.tsx),
// in this site's light colours with the orange as the accent.

/**
 * Numbered circles connected by lines that fill in as you advance — the
 * connector after a circle animates from empty to full the moment you
 * move past it, so Next reads as visible progress. The numbers already
 * say "step 2 of 4", so there's no caption underneath.
 */
export function WizardStepIndicator({ total, current }: { total: number; current: number }) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-sm items-center" aria-label={`Step ${current} of ${total}`} role="img">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <Fragment key={n}>
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 sm:h-8 sm:w-8 sm:text-sm ${
              n <= current ? "border-terracotta-deep bg-terracotta-deep text-white" : "border-line bg-white text-text-2"
            }`}
          >
            {n}
          </div>
          {n !== total && (
            <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-line sm:mx-1.5">
              <div
                className={`h-full bg-terracotta-deep transition-all duration-500 ease-out ${n < current ? "w-full" : "w-0"}`}
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
