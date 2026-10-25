"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, isPrivatePath, loadMetaPixel, trackMetaEvent } from "@/lib/meta-pixel";
import { CONSENT_CHANGED_EVENT, CONSENT_GRANTED, readConsent } from "@/lib/cookie-consent";
import { captureFirstTouch } from "@/lib/first-touch";

// Before anything else: this reads the landing page's address and
// referrer, which only stay true until the visitor moves on. It stores
// nothing on the device and sends nothing anywhere (the booking form reads
// it when it's sent), so it runs whether or not the pixel is set up.
captureFirstTouch();

/**
 * The Meta Pixel, from Kanvas Academy: loads Meta's script and sends a
 * PageView for each page. Renders nothing.
 *
 * Does nothing at all until NEXT_PUBLIC_META_PIXEL_ID is set, and then only
 * for a visitor who accepted the cookie banner, and never on the private
 * pages (lib/meta-pixel.ts). Consent is read from the cookie in the
 * browser rather than on the server, so the pages stay static; the script
 * loads after the page is interactive either way.
 *
 * PageViews are sent from here rather than by the pixel itself, so moving
 * from a public page to a private one in the same tab sends nothing.
 *
 * Also reports a tap on a phone or WhatsApp link as Meta's Contact event,
 * since for MPE that's how most people get in touch. Only a tap: whether
 * the call went through, Meta isn't told.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const [granted, setGranted] = useState(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    function onChange() {
      if (readConsent() === CONSENT_GRANTED) setGranted(true);
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID || isPrivatePath(pathname)) return;
    if (!granted && readConsent() !== CONSENT_GRANTED) return;
    // Development runs effects twice, and a doubled PageView would inflate
    // the numbers this is here to make trustworthy.
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    loadMetaPixel();
    window.fbq?.("track", "PageView");
  }, [pathname, granted]);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="tel:"], a[href^="https://wa.me/"]');
      if (!link) return;
      // A no-op unless the pixel loaded, which is what keeps this behind consent.
      trackMetaEvent("Contact", { content_name: link.href.startsWith("tel:") ? "Phone" : "WhatsApp" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
