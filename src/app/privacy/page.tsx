import type { Metadata } from "next";
import { ContentPageLayout } from "@/components/ContentPageLayout";
import { RichContent } from "@/components/RichContent";
import { privacyContent, lastUpdated } from "@/lib/legalPages";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MPE collects, uses and protects your personal information.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: { url: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <ContentPageLayout eyebrow="Legal" title="Privacy Policy" meta={`Last updated: ${lastUpdated}`}>
      <RichContent blocks={privacyContent} />
    </ContentPageLayout>
  );
}
