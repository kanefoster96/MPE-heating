"use client";

import { useEffect } from "react";

/**
 * Remembers whose referral link someone came in on (the mpe_ref cookie,
 * first-party, 60 days), so the booking form they send can be linked to
 * the customer who recommended them (lib/referrals.ts).
 */
export function RefCookie({ code, days }: { code: string; days: number }) {
  useEffect(() => {
    document.cookie = `mpe_ref=${encodeURIComponent(code)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [code, days]);
  return null;
}
