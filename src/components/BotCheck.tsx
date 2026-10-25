"use client";

import { HONEYPOT_FIELD } from "@/lib/spamGuard";

// Ported from Kanvas Academy (src/components/bot-check-fields.tsx).

/**
 * How long a form has been open, for its submit handler to send as fillMs.
 * Both ends are this browser's clock, so one that's out doesn't matter.
 * Only for event handlers: Date.now() in render would be wrong.
 */
export function fillMsSince(openedAt: number): number {
  return Date.now() - openedAt;
}

/**
 * The hidden honeypot box, for a form that keeps its fields in state.
 * Hidden from people and screen readers; bots fill it in.
 */
export function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD}>Leave this empty</label>
      <input
        id={HONEYPOT_FIELD}
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
