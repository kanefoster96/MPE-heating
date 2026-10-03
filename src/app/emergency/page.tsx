import type { Metadata } from "next";
import { Suspense } from "react";
import { Funnel } from "@/components/Funnel";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Same-Day Boiler Call-Out | £50, Refunded When Fixed",
  description:
    "Boiler broken down? Book a same-day call-out in Whitley Bay and across the North East. £50 call-out refunded in full when we do the repair, price agreed before any work starts.",
  alternates: { canonical: `${SITE_URL}/emergency` },
  openGraph: { url: `${SITE_URL}/emergency` },
};

// The emergency call-out form: the funnel opened straight at boiler repair.
export default function EmergencyPage() {
  return (
    <Suspense fallback={null}>
      <Funnel
        initialPath={["boilers", "repair"]}
        locked
        eyebrow="Boiler repair"
        title={{ lead: "Same-day call-out.", em: "£50, refunded when fixed." }}
        subtitle="Two minutes. We ring you back to confirm a time, come out for £50, and agree the repair price before any work starts."
      />
    </Suspense>
  );
}
