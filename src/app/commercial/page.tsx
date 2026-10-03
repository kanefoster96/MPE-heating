import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ChecklistSection } from "@/components/ChecklistSection";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
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
      <main>
        <ServicePageHero
          icon={<Icon />}
          eyebrow={commercialPage.eyebrow}
          headline={commercialPage.headline}
          status={commercialPage.status}
          subline={commercialPage.subline}
          cta={commercialPage.cta}
          type={commercialPage.enquiry}
          shortCta="Get a quote"
          reassurance={commercialPage.reassurance}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          heading={{ lead: "Keep trading.", em: "We handle the rest." }}
          items={commercialPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return { icon: <FeatureIconComponent />, title: f.title, text: f.text };
          })}
        />

        <ChecklistSection
          eyebrow="What we cover"
          heading={{ lead: "Commercial services.", em: "All under one roof." }}
          items={commercialPage.checklistItems}
          note="Maintenance contracts include priority call-out, and we can invoice on account for commercial and landlord clients."
        />

        <Reviews />
        <FinalCta heading={{ lead: "Downtime costs money.", em: "Let's get it sorted." }} cta="Get a commercial quote" shortCta="Get a quote" type="commercial" />
      </main>
      <Footer />
      <JsonLd data={serviceJsonLd(commercialPage)} />
    </>
  );
}
