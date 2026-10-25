import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CHAT_ON } from "@/lib/chat-on";
import { logout } from "../login/actions";

export const metadata: Metadata = {
  title: "Team inbox",
  robots: { index: false, follow: false },
};

// The team's side of the site: a slim 4rem bar (the conversation page
// sizes its thread to the rest of the screen) with the inbox and log out.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
        <Link href="/staff/messages" className="flex min-h-11 items-center gap-2 font-semibold">
          <Image src="/mpe-logo.png" alt="" width={1189} height={513} className="h-8 w-auto" />
          Team inbox
        </Link>
        {CHAT_ON && (
          <form action={logout}>
            <button
              type="submit"
              className="min-h-11 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </form>
        )}
      </header>
      {children}
    </div>
  );
}
