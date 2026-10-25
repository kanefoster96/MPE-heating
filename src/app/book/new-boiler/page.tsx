import type { Metadata } from "next";
import { Suspense } from "react";
import { StepFlow } from "@/components/StepFlow";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free New Boiler Quote",
  description: "Get a free fixed-price quote for a new boiler in Whitley Bay and across the North East. A few taps: what you need, your current boiler and gas supply, home size and budget.",
  alternates: { canonical: `${SITE_URL}/book/new-boiler` },
  openGraph: { url: `${SITE_URL}/book/new-boiler` },
};

// The new boiler quote: cards for what you need, current boiler, gas supply, bedrooms, budget and timing, then postcode and where to send the quote.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <StepFlow flowKey="newBoiler" />
    </Suspense>
  );
}
