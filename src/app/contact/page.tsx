import type { Metadata } from "next";
import { Suspense } from "react";
import { business } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Book a Visit",
  description: `Book a same-day boiler repair, an annual service or a free new-boiler quote. Two minutes online and we ring you back — or call ${business.phoneDisplay} directly.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { url: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  // Suspense is required around useSearchParams() so the rest of the page
  // can still be statically rendered.
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}
