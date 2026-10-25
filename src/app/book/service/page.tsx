import type { Metadata } from "next";
import { Suspense } from "react";
import { StepFlow } from "@/components/StepFlow";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a Boiler Service",
  description: "Book an annual boiler service in Whitley Bay and across the North East, from £79. About 45 minutes, and it keeps your boiler warranty valid.",
  alternates: { canonical: `${SITE_URL}/book/service` },
  openGraph: { url: `${SITE_URL}/book/service` },
};

// The service booking: boiler make, last service, time of day, postcode, then contact details.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <StepFlow flowKey="service" />
    </Suspense>
  );
}
