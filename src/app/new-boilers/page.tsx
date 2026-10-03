import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ChecklistSection } from "@/components/ChecklistSection";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { newBoilersPage } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { SITE_URL, serviceJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "New Boiler Installation Whitley Bay & North East | Free Fixed-Price Quote",
  description: newBoilersPage.subline,
  alternates: { canonical: `${SITE_URL}/${newBoilersPage.slug}` },
  openGraph: { url: `${SITE_URL}/${newBoilersPage.slug}` },
};

export default function NewBoilersPage() {
  const Icon = featureIconMap[newBoilersPage.icon];

  return (
    <>
      <Nav />
      <main>
        <ServicePageHero
          icon={<Icon />}
          eyebrow={newBoilersPage.eyebrow}
          headline={newBoilersPage.headline}
          status={newBoilersPage.status}
          subline={newBoilersPage.subline}
          cta={newBoilersPage.cta}
          type={newBoilersPage.enquiry}
          shortCta="Get a quote"
          reassurance={newBoilersPage.reassurance}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          heading={{ lead: "Everything handled.", em: "Nothing left for you to chase." }}
          items={newBoilersPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return { icon: <FeatureIconComponent />, title: f.title, text: f.text };
          })}
        />

        <ChecklistSection
          eyebrow="Is it time?"
          heading={{ lead: "Signs it might be time.", em: "Before it fails in January." }}
          items={newBoilersPage.checklistItems}
          note="Not sure? Ask for a quote anyway. It's free, there's no obligation, and if a repair makes more sense we'll say so."
        />

        <Reviews />
        <FinalCta heading={{ lead: "Thinking about a new boiler?", em: "Get a free fixed-price quote." }} cta="Get a free quote" shortCta="Get a quote" type="quote" />
      </main>
      <Footer />
      <JsonLd data={serviceJsonLd(newBoilersPage)} />
      <JsonLd data={breadcrumbJsonLd([{ name: "New boilers", path: `/${newBoilersPage.slug}` }])} />
    </>
  );
}
