import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { FormIcon } from "@/components/icons";
import { helpArticles } from "@/lib/help";
import { SITE_URL } from "@/lib/seo";
import { HelpList } from "./HelpList";

export const metadata: Metadata = {
  title: "Boiler Advice & Guides",
  description:
    "Common boiler problems explained, why servicing matters, and how to tell when it's time for a new boiler — advice from MPE's Gas Safe engineers.",
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: { url: `${SITE_URL}/help` },
};

export default function HelpIndexPage() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<FormIcon className="h-full w-full" />}
          eyebrow="Advice & Guides"
          headline="Boiler advice from people who fix them"
          subline="Common problems explained, honest advice on servicing, and no-nonsense answers — from MPE's Gas Safe engineers across the North East."
          cta="Ask us a question"
          ticks={["Gas Safe registered", "Written by engineers", "No jargon"]}
        />

        <HelpList posts={helpArticles} />

        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
