import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { NoteIcon } from "@/components/icons";
import { helpArticles } from "@/lib/help";
import { SITE_URL } from "@/lib/seo";
import { HelpList } from "./HelpList";

export const metadata: Metadata = {
  title: "Boiler Advice & Guides",
  description:
    "Common boiler problems explained, why servicing matters, and how to tell when it's time for a new boiler — advice from MPE's Gas Safe engineers.",
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: { url: `${SITE_URL}/help` },
};

export default function HelpIndexPage() {
  return (
    <>
      <Nav />
      <main>
        <ServicePageHero
          icon={<NoteIcon />}
          eyebrow="Help and advice"
          headline={{ lead: "Boiler advice.", em: "From people who fix them." }}
          subline="Common problems explained, honest advice on servicing, and plain answers from Gas Safe engineers."
          cta="Ask us a question"
          type="other"
          reassurance="If it's quicker to ask than to read, WhatsApp us and an engineer will answer."
        />

        <HelpList posts={helpArticles} />

        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
