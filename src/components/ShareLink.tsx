"use client";

import { useState } from "react";

/** Share a link: the phone's own share sheet where there is one, else copy it. */
export function ShareLink({ url, text, label = "Share your link" }: { url: string; text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // Closed the sheet: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-share-link>
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-6 font-semibold text-white transition-opacity hover:opacity-90"
      >
        {copied ? "Link copied" : label}
      </button>
      <span className="break-all text-sm text-text-2" aria-live="polite">
        {url}
      </span>
    </div>
  );
}
