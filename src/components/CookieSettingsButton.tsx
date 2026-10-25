"use client";

import { CONSENT_COOKIE_NAME } from "@/lib/cookie-consent";

/** Lets someone change their cookie answer as easily as they gave it (Kanvas Academy): clears it and reloads, which brings the banner back. */
export function CookieSettingsButton({ className }: { className?: string }) {
  function handleClick() {
    document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    window.location.reload();
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      Cookie settings
    </button>
  );
}
