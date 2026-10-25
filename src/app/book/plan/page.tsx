import type { Metadata } from "next";
import { Suspense } from "react";
import { StepFlow } from "@/components/StepFlow";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Boiler Maintenance Plan",
  description: "A boiler maintenance plan from MPE: free call-outs all year round and a free yearly service. Tell us about your boiler and we'll send the price and details.",
  alternates: { canonical: `${SITE_URL}/book/plan` },
  openGraph: { url: `${SITE_URL}/book/plan` },
};

// The maintenance plan: who it's for, boiler age and make, postcode, then where to send the plan details.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <StepFlow flowKey="plan" />
    </Suspense>
  );
}
