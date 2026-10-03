import type { Metadata } from "next";
import { Suspense } from "react";
import { Funnel } from "@/components/Funnel";
import { business } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Ask MPE anything about boilers, plumbing or electrics. Send a message and we ring you back, or call ${business.phoneDisplay}.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { url: `${SITE_URL}/contact` },
};

// The contact form: the funnel opened straight at "something else".
export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <Funnel
        initialPath={["other"]}
        locked
        eyebrow="Contact us"
        title={{ lead: "Ask us anything.", em: "We ring you back." }}
        subtitle="A question, a quote, or something that doesn't fit a box. Tell us and we'll point you to the right engineer."
      />
    </Suspense>
  );
}
