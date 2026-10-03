import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
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
      <main>
        <ServicePageHero
          icon={<QuestionIcon />}
          eyebrow={faqsPage.eyebrow}
          headline={faqsPage.headline}
          status={faqsPage.status}
          subline={faqsPage.subline}
          cta={faqsPage.cta}
          type={faqsPage.enquiry}
          shortCta="Ask us"
          reassurance={faqsPage.reassurance}
        />

        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <JsonLd data={faqPageJsonLd([...faqs.homes, ...faqs.commercial])} />
    </>
  );
}
