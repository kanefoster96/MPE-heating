import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { faqsPage, business } from "@/lib/content";
import { QuestionIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: `FAQs | ${business.fullName}`,
  description: faqsPage.subline,
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
    </>
  );
}
