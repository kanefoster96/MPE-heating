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
import { boilerRepairPage } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { SITE_URL, serviceJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Boiler Repairs North East",
  description: boilerRepairPage.subline,
  alternates: { canonical: `${SITE_URL}/${boilerRepairPage.slug}` },
  openGraph: { url: `${SITE_URL}/${boilerRepairPage.slug}` },
};

export default function BoilerRepairPage() {
  const Icon = featureIconMap[boilerRepairPage.icon];

  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<Icon className="h-full w-full" />}
          eyebrow={boilerRepairPage.eyebrow}
          headline={boilerRepairPage.headline}
          subline={boilerRepairPage.subline}
          cta={boilerRepairPage.cta}
          ticks={boilerRepairPage.ticks}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          title="Boiler repairs, done properly"
          items={boilerRepairPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return {
              icon: <FeatureIconComponent className="h-7 w-7" />,
              title: f.title,
              text: f.text,
            };
          })}
        />

        <ChecklistSection
          eyebrow="What we fix"
          title={boilerRepairPage.checklistTitle}
          items={boilerRepairPage.checklistItems}
        />

        <GuaranteeBlock />
        <Reviews />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
      <JsonLd data={serviceJsonLd(boilerRepairPage)} />
    </>
  );
}
