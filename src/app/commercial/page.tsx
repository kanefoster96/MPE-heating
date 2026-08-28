import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ChecklistSection } from "@/components/ChecklistSection";
import { GuaranteeBlock } from "@/components/GuaranteeBlock";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { commercialPage } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { SITE_URL, serviceJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Commercial Gas, Heating & Electrics",
  description: commercialPage.subline,
  alternates: { canonical: `${SITE_URL}/${commercialPage.slug}` },
  openGraph: { url: `${SITE_URL}/${commercialPage.slug}` },
};

export default function CommercialPage() {
  const Icon = featureIconMap[commercialPage.icon];

  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<Icon className="h-full w-full" />}
          eyebrow={commercialPage.eyebrow}
          headline={commercialPage.headline}
          subline={commercialPage.subline}
          cta={commercialPage.cta}
          ticks={commercialPage.ticks}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          title="Commercial work, handled properly"
          items={commercialPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return {
              icon: <FeatureIconComponent className="h-7 w-7" />,
              title: f.title,
              text: f.text,
            };
          })}
        />

        <ChecklistSection
          eyebrow="What we cover"
          title={commercialPage.checklistTitle}
          items={commercialPage.checklistItems}
        />

        <GuaranteeBlock />
        <Reviews />
        <FinalCta
          headline="Run a business? Let's talk."
          cta="Enquire about commercial services"
          icon={<Icon className="h-full w-full" />}
        />
      </main>
      <Footer />
      <FloatingWhatsapp />
      <JsonLd data={serviceJsonLd(commercialPage)} />
    </>
  );
}
