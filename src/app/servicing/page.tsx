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
import { servicingPage } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { SITE_URL, serviceJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Boiler Servicing North East",
  description: servicingPage.subline,
  alternates: { canonical: `${SITE_URL}/${servicingPage.slug}` },
  openGraph: { url: `${SITE_URL}/${servicingPage.slug}` },
};

export default function ServicingPage() {
  const Icon = featureIconMap[servicingPage.icon];

  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<Icon className="h-full w-full" />}
          eyebrow={servicingPage.eyebrow}
          headline={servicingPage.headline}
          subline={servicingPage.subline}
          cta={servicingPage.cta}
          ticks={servicingPage.ticks}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          title="A service that's actually worth having"
          items={servicingPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return {
              icon: <FeatureIconComponent className="h-7 w-7" />,
              title: f.title,
              text: f.text,
            };
          })}
        />

        <ChecklistSection
          eyebrow="What we check"
          title={servicingPage.checklistTitle}
          items={servicingPage.checklistItems}
        />

        <GuaranteeBlock />
        <Reviews />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
      <JsonLd data={serviceJsonLd(servicingPage)} />
    </>
  );
}
