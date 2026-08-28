import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your MPE account to view bookings, invoices and messages.",
  alternates: { canonical: `${SITE_URL}/login` },
  // Account pages have no unique content for search or AI answer engines —
  // keep them out of the index rather than diluting relevance.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginForm />;
}
