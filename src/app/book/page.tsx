import type { Metadata } from "next";
import { Suspense } from "react";
import { Funnel } from "@/components/Funnel";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a Visit | Boilers, Plumbing, Electrics, Commercial",
  description:
    "Pick what you need and book in two minutes: boiler repairs and servicing, new boilers, plumbing, electrics, landlord certificates and commercial cover across the North East.",
  alternates: { canonical: `${SITE_URL}/book` },
  openGraph: { url: `${SITE_URL}/book` },
};

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <Funnel
        eyebrow="Book a visit"
        title={{ lead: "What do you need?", em: "Pick one to start." }}
        subtitle="Two minutes. We ring you back to confirm a time, and agree the price before any work starts."
      />
    </Suspense>
  );
}
