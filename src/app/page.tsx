import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { Hero } from "@/components/Hero";
import { QuickPick } from "@/components/QuickPick";
import { BrandsRow } from "@/components/BrandsRow";
import { ProblemFix } from "@/components/ProblemFix";
import { HowItWorks } from "@/components/HowItWorks";
import { Promises } from "@/components/Promises";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { CommercialBanner } from "@/components/CommercialBanner";
import { AreasCovered } from "@/components/AreasCovered";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { faqs } from "@/lib/content";
import { faqPageJsonLd } from "@/lib/seo";

const HOME_FAQS = 4;

// Page order: hero and the main ask; a card for every job so people can
// tap straight to what they want; the worries we fix; how easy it is;
// four promise badges; reviews; the top questions; a push to business
// owners; town chips; the ask again with a second option.
export default function Home() {
  return (
    <>
      <Nav />
      <PromoBar />
      <main>
        <Hero />
        <QuickPick />
        <BrandsRow />
        <ProblemFix />
        <HowItWorks />
        <Promises />
        <Reviews />
        <Faq limit={HOME_FAQS} />
        <CommercialBanner />
        <AreasCovered />
        <FinalCta secondary={{ label: "Book a service or something else", href: "/book" }} />
      </main>
      <Footer />
      <JsonLd data={faqPageJsonLd(faqs.homes.slice(0, HOME_FAQS))} />
    </>
  );
}
