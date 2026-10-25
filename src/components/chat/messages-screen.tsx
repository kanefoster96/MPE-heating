"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Messages, as a screen rather than a panel (ported from Kanvas Academy).
 *
 * A chat inside a scrolling page means two scrollbars fighting: the thread
 * scrolls, the page scrolls, and on a phone the composer drifts up the
 * screen as you move. Every messaging app people already use fills the
 * screen and pins the composer to the bottom, so this does the same —
 * covering the site's nav and footer while it's open, with one cross to
 * come back out.
 *
 * `100dvh` rather than `100vh` on purpose: on mobile Safari `vh` counts
 * the space behind the browser's own toolbars, which would push the
 * composer off the bottom of the screen. The `env(safe-area-inset-*)`
 * padding resolves to zero unless the viewport opts into the display
 * cutout, so it costs nothing today and is already right if we ever ship
 * this as an installed web app.
 */
export function MessagesScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // The page underneath must not scroll while this covers it — otherwise
  // dragging the thread on a phone scrolls the site behind it instead.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function close() {
    // Back where they came from, so closing the chat doesn't lose the page
    // they opened it from. Straight to the homepage if they arrived here
    // cold (a push notification, a bookmark, a link from elsewhere).
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      // A referrer we can't parse is one we shouldn't trust — fall through.
    }
    router.push("/");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close messages"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground/40 hover:text-foreground active:bg-foreground/10"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
      </div>
    </div>
  );
}
