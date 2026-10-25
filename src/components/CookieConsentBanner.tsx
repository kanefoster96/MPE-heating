"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE_DAYS,
  CONSENT_COOKIE_NAME,
  CONSENT_DENIED,
  CONSENT_GRANTED,
  readConsent,
} from "@/lib/cookie-consent";
import { META_PIXEL_ID, isPrivatePath } from "@/lib/meta-pixel";
import { getFirstTouch } from "@/lib/first-touch";

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Once they've said yes: write the advert's click id as `_fbc`, the way the
 * pixel would have. The pixel only does that itself if ?fbclid= is still in
 * the address bar when it loads, and someone who taps an advert, moves on
 * to a booking form and accepts there has lost it, so their booking would
 * report with no advert behind it. The landing page's address is held in
 * memory until now (lib/first-touch.ts), never on the device.
 */
const AD_CLICK_COOKIE_DAYS = 90;
function storeAdClickAfterConsent() {
  const id = new URLSearchParams(getFirstTouch().search).get("fbclid");
  if (!id || document.cookie.split("; ").some((r) => r.startsWith("_fbc="))) return;
  // fb.<subdomain index>.<creation time ms>.<fbclid>; 1 = the root domain.
  setCookie("_fbc", `fb.1.${Date.now()}.${id}`, AD_CLICK_COOKIE_DAYS);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}

/**
 * The cookie banner, from Kanvas Academy: a card at the bottom of the
 * screen, shown until someone answers. Only exists once
 * NEXT_PUBLIC_META_PIXEL_ID is set (until then there's nothing to ask
 * about), and never on the private pages, where the pixel doesn't run.
 *
 * It's in the page's HTML for everyone, so it shows with the page rather
 * than waiting for the JavaScript (the Academy found most visitors from an
 * advert had gone before a late banner appeared, and never loaded the
 * pixel). For someone who has already answered, a class set on <html>
 * before first paint hides it (app/layout.tsx), and it then leaves the
 * page once the JavaScript is running.
 *
 * The buttons are a plain form too, so a tap before the JavaScript is
 * ready still works, through /api/cookie-consent and a reload.
 *
 * Decline is exactly as easy as Accept: same size, same row, one tap.
 * Consent that costs more to refuse than to give isn't freely given, and
 * the pixel resting on it would be worth nothing.
 */
export function CookieConsentBanner() {
  const pathname = usePathname();
  // False on the server and while hydrating, so the first render matches the HTML.
  const answered = useSyncExternalStore(subscribe, () => readConsent() !== null, () => false);

  if (!META_PIXEL_ID || answered || isPrivatePath(pathname)) return null;

  function answer(event: React.MouseEvent, value: string) {
    event.preventDefault();
    setCookie(CONSENT_COOKIE_NAME, value, CONSENT_COOKIE_DAYS);
    if (value === CONSENT_GRANTED) storeAdClickAfterConsent();
    // The pixel (components/MetaPixel.tsx) starts on this, no reload needed.
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }

  return (
    // [.consent-set_&]:hidden is CONSENT_SET_CLASS, written out so Tailwind can see it.
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-4 animate-fade-up [.consent-set_&]:hidden"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      data-cookie-banner
    >
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-5 text-navy shadow-2xl shadow-navy/20">
        <p className="text-base font-semibold">Cookie settings</p>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          It&rsquo;s entirely up to you. If you accept, cookies help us get our adverts in front of the right people and see which ones work. Declining doesn&rsquo;t change the
          site. You can read our privacy policy{" "}
          <Link href="/privacy" className="font-medium text-navy underline underline-offset-2">
            here
          </Link>
          .
        </p>
        <form method="post" action="/api/cookie-consent" className="mt-4 flex gap-2">
          <button
            type="submit"
            name="choice"
            value={CONSENT_DENIED}
            onClick={(e) => answer(e, CONSENT_DENIED)}
            className="min-h-11 flex-1 rounded-full border border-line px-4 text-sm font-semibold text-navy transition-colors hover:border-navy/40 active:bg-navy/10"
          >
            Decline
          </button>
          <button
            type="submit"
            name="choice"
            value={CONSENT_GRANTED}
            onClick={(e) => answer(e, CONSENT_GRANTED)}
            className="min-h-11 flex-1 rounded-full bg-terracotta-deep px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
          >
            Accept
          </button>
        </form>
      </div>
    </div>
  );
}
