import type { Metadata } from "next";
import { CalloutsAdmin } from "./CalloutsAdmin";

// Not linked from anywhere public, and explicitly noindex'd — this is a
// working preview of the admin flow (see CalloutsAdmin.tsx for what's
// mocked vs. real), not a page for search engines or customers to find.
// It also has no real access control yet: today the "gate" is that the
// URL isn't published anywhere. TODO(supabase): once Supabase auth is
// wired up, gate this route on the caller's `profiles.is_admin` flag
// (see is_admin() in supabase/migrations/20260828000000_init.sql) rather
// than relying on obscurity.
export const metadata: Metadata = {
  title: "Confirm callouts — Admin",
  robots: { index: false, follow: false },
};

export default function CalloutsAdminPage() {
  return <CalloutsAdmin />;
}
