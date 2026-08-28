import type { Metadata } from "next";
import { ContentPageLayout } from "@/components/ContentPageLayout";
import { RichContent } from "@/components/RichContent";
import { FinalCta } from "@/components/FinalCta";
import { aboutPageContent, business } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Us",
  description: `${business.fullName} is a family-run, Gas Safe registered heating, plumbing and electrical business covering ${business.region}.`,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { url: `${SITE_URL}/about` },
};

export default function AboutPage() {
  return (
    <ContentPageLayout
      eyebrow="About Us"
      title={`About ${business.name}`}
      afterContent={<FinalCta />}
    >
      <RichContent blocks={aboutPageContent} />
    </ContentPageLayout>
  );
}
