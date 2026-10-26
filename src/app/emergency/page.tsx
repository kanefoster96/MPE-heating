import type { Metadata } from "next";
import { Suspense } from "react";
import { StepFlow } from "@/components/StepFlow";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Boiler Call-Out | £50, Taken Off Your Repair",
  description:
    "Boiler broken down? Book a call-out in Whitley Bay and across the North East in a few quick steps. £50 call-out, taken off your repair bill if you go ahead, price agreed before any work starts.",
  alternates: { canonical: `${SITE_URL}/emergency` },
  openGraph: { url: `${SITE_URL}/emergency` },
};

// The call-out form: what's wrong, a sentence about it, postcode, then
// email and mobile.
export default function EmergencyPage() {
  return (
    <Suspense fallback={null}>
      <StepFlow flowKey="callout" />
    </Suspense>
  );
}
