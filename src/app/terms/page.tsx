import type { Metadata } from "next";
import { ContentPageLayout } from "@/components/ContentPageLayout";
import { RichContent } from "@/components/RichContent";
import { termsContent, lastUpdated } from "@/lib/legalPages";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply to any booking, quote or work carried out by MPE.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: { url: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <ContentPageLayout eyebrow="Legal" title="Terms & Conditions" meta={`Last updated: ${lastUpdated}`}>
      <RichContent blocks={termsContent} />
    </ContentPageLayout>
  );
}
