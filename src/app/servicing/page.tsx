import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ChecklistSection } from "@/components/ChecklistSection";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
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
      <main>
        <ServicePageHero
          icon={<Icon />}
          eyebrow={servicingPage.eyebrow}
          headline={servicingPage.headline}
          status={servicingPage.status}
          subline={servicingPage.subline}
          cta={servicingPage.cta}
          type={servicingPage.enquiry}
          reassurance={servicingPage.reassurance}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          heading={{ lead: "A service that's worth having.", em: "Not a box ticked." }}
          items={servicingPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return { icon: <FeatureIconComponent />, title: f.title, text: f.text };
          })}
        />

        <ChecklistSection
          eyebrow="What we check"
          heading={{ lead: "What's included.", em: "Every time." }}
          items={servicingPage.checklistItems}
          note="Around 45 minutes. You get a written report and a Gas Safe certificate, and we remind you when the next one is due."
        />

        <Reviews />
        <FinalCta heading={{ lead: "Due a service?", em: "Book it in two minutes." }} cta="Book a service" shortCta="Book" type="service" />
      </main>
      <Footer />
      <JsonLd data={serviceJsonLd(servicingPage)} />
    </>
  );
}
