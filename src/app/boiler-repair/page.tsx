import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ChecklistSection } from "@/components/ChecklistSection";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { boilerRepairPage, guarantee } from "@/lib/content";
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
      <main>
        <ServicePageHero
          icon={<Icon />}
          eyebrow={boilerRepairPage.eyebrow}
          headline={boilerRepairPage.headline}
          status={boilerRepairPage.status}
          subline={boilerRepairPage.subline}
          cta={boilerRepairPage.cta}
          type={boilerRepairPage.enquiry}
          reassurance={boilerRepairPage.reassurance}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          heading={{ lead: "The repair.", em: "Without the usual headaches." }}
          items={boilerRepairPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return { icon: <FeatureIconComponent />, title: f.title, text: f.text };
          })}
        />

        <ChecklistSection
          eyebrow="What we fix"
          heading={{ lead: "Common boiler problems.", em: "Most fixed in one visit." }}
          items={boilerRepairPage.checklistItems}
          note={guarantee.text}
        />

        <Reviews />
        <FinalCta />
      </main>
      <Footer />
      <JsonLd data={serviceJsonLd(boilerRepairPage)} />
    </>
  );
}
