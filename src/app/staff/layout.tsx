import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CHAT_ON } from "@/lib/chat-on";
import { logout } from "../login/actions";
import { StaffNav } from "@/components/staff/staff-nav";
import { enquiriesOn } from "@/lib/enquiries";
import { waitingOnTeamCount } from "@/lib/appointments";
import { londonNow } from "@/lib/schedule-time";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/coach";

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: { default: "Team", template: "%s | MPE team" },
  robots: { index: false, follow: false },
};

// The team's side of the site: a slim 4rem bar (the conversation page
// sizes its thread to the rest of the screen) with home, the inbox, the
// schedule, customers and log out (on a phone, log out is on home).
export default async function StaffLayout({ children }: { children: ReactNode }) {
  // Customers' requests and asks to move, badged on the Schedule tab.
  const waiting = enquiriesOn() ? await waitingOnTeamCount(londonNow().dateISO).catch(() => 0) : 0;
  // Settings (products and prices) are for admins.
  let admin = false;
  if (CHAT_ON) {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    admin = !!user && (await isAdmin(user.id).catch(() => false));
  }
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/staff" className="hidden min-h-11 shrink-0 items-center sm:flex">
            <Image src="/mpe-logo.png" alt="MPE team" width={1189} height={513} className="h-8 w-auto" />
          </Link>
          <StaffNav waiting={waiting} />
        </div>
        {CHAT_ON && (
          <div className="flex shrink-0 items-center">
          {admin && (
            <Link href="/staff/settings" aria-label="Settings" title="Settings" className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground">
              <GearIcon className="h-5 w-5" />
            </Link>
          )}
          <form action={logout} className="hidden sm:block">
            <button
              type="submit"
              className="min-h-11 shrink-0 rounded-full px-2 text-sm font-medium text-muted transition-colors hover:text-foreground sm:px-4"
            >
              Log out
            </button>
          </form>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
