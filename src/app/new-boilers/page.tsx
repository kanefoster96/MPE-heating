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
import { newBoilersPage, business } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";

export const metadata: Metadata = {
  title: `New Boilers | ${business.fullName}`,
  description: newBoilersPage.subline,
};

export default function NewBoilersPage() {
  const Icon = featureIconMap[newBoilersPage.icon];

  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<Icon className="h-full w-full" />}
          eyebrow={newBoilersPage.eyebrow}
          headline={newBoilersPage.headline}
          subline={newBoilersPage.subline}
          cta={newBoilersPage.cta}
          ticks={newBoilersPage.ticks}
        />

        <FeatureGrid
          eyebrow="Why book with MPE"
          title="A new boiler, done right"
          items={newBoilersPage.features.map((f) => {
            const FeatureIconComponent = featureIconMap[f.icon];
            return {
              icon: <FeatureIconComponent className="h-7 w-7" />,
              title: f.title,
              text: f.text,
            };
          })}
        />

        <ChecklistSection
          eyebrow="Is it time?"
          title={newBoilersPage.checklistTitle}
          items={newBoilersPage.checklistItems}
        />

        <GuaranteeBlock />
        <Reviews />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
