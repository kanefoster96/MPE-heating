import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";

// Not linked from anywhere public, and noindex'd across the whole /admin
// tree — this is a working preview of the admin flow (see mockData.ts for
// what's mocked), not a page for search engines or customers to find. It
// also has no real access control yet: today the "gate" is that the URL
// isn't published anywhere. TODO(supabase): once Supabase auth is wired
// up, gate this whole tree on the caller's `profiles.is_admin` flag (see
// is_admin() in supabase/migrations/20260828000000_init.sql) rather than
// relying on obscurity.
export const metadata: Metadata = {
  title: { template: "%s — Admin", default: "Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
