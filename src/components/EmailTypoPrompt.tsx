"use client";

import { useState } from "react";
import { emailTypoCheck } from "@/lib/emailTypo";

// Ported from Kanvas Academy (src/components/email-typo-prompt.tsx), in
// this site's light colours.

/**
 * "Is this definitely your email?" — shown when an address looks like a
 * slip of a well-known provider (lib/emailTypo.ts). One tap takes the
 * suggested spelling, the other keeps it as typed.
 */
export function EmailTypoPrompt({
  email,
  suggestion,
  onUse,
  onConfirm,
}: {
  email: string;
  suggestion: string | null;
  onUse: (suggestion: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div role="alertdialog" aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-red/30 bg-red/5 p-4 text-sm text-navy">
      <p>
        Is this definitely your email? <strong className="break-all">{email.trim()}</strong>
        {suggestion && (
          <>
            {" "}
            Did you mean <strong className="break-all">{suggestion}</strong>?
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestion && (
          <button
            type="button"
            onClick={() => onUse(suggestion)}
            className="min-h-11 rounded-full bg-terracotta-deep px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Use {suggestion.slice(suggestion.lastIndexOf("@"))}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:border-navy/40"
        >
          Yes, it&apos;s correct
        </button>
      </div>
    </div>
  );
}

/**
 * For a controlled form: call `check()` before submitting. It returns true
 * when it's fine to go ahead; otherwise it shows the prompt (render
 * `renderPrompt(submit)`) and the caller stops. Either answer then calls
 * `submit` straight away with the chosen address, passed in because the
 * state update hasn't landed yet.
 */
export function useEmailTypoCheck(email: string, setEmail: (email: string) => void) {
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ email: string; suggestion: string | null } | null>(null);
  // The prompt is about the address as it was; typing a new one clears it.
  const shown = asking && asking.email === email ? asking : null;

  function check(): boolean {
    const trimmed = email.trim();
    if (confirmed === trimmed) return true;
    const typo = emailTypoCheck(trimmed);
    if (!typo) return true;
    setAsking({ email, suggestion: typo.suggestion });
    return false;
  }

  const renderPrompt = (submit: (email: string) => void) =>
    shown ? (
      <EmailTypoPrompt
        email={shown.email}
        suggestion={shown.suggestion}
        onUse={(fixed) => {
          setEmail(fixed);
          setConfirmed(fixed);
          setAsking(null);
          submit(fixed);
        }}
        onConfirm={() => {
          const kept = shown.email.trim();
          setConfirmed(kept);
          setAsking(null);
          submit(kept);
        }}
      />
    ) : null;

  return { check, renderPrompt };
}
