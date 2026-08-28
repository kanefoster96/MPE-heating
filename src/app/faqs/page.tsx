import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { faqsPage, faqs } from "@/lib/content";
import { QuestionIcon } from "@/components/icons";
import { SITE_URL, faqPageJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "FAQs",
  description: faqsPage.subline,
  alternates: { canonical: `${SITE_URL}/faqs` },
  openGraph: { url: `${SITE_URL}/faqs` },
};

export default function FaqsPage() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<QuestionIcon className="h-full w-full" />}
          eyebrow={faqsPage.eyebrow}
          headline={faqsPage.headline}
          subline={faqsPage.subline}
          cta={faqsPage.cta}
          ticks={faqsPage.ticks}
        />

        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
      <JsonLd data={faqPageJsonLd([...faqs.homes, ...faqs.commercial])} />
    </>
  );
}
