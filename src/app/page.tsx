import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { Hero } from "@/components/Hero";
import { BrandsRow } from "@/components/BrandsRow";
import { PainPoints } from "@/components/PainPoints";
import { Solution } from "@/components/Solution";
import { HowItWorks } from "@/components/HowItWorks";
import { OfferList } from "@/components/OfferList";
import { Faq } from "@/components/Faq";
import { Reviews } from "@/components/Reviews";
import { ServicePicker } from "@/components/ServicePicker";
import { AreasCovered } from "@/components/AreasCovered";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { faqs } from "@/lib/content";
import { faqPageJsonLd } from "@/lib/seo";

// Page order: hero and the ask; the pain points we understand; how we
// solve it; how easy it is to book; guarantees and risk removal (the one
// ticked list); questions; reviews; all services with a push to business
// owners; where we cover; the final ask.
export default function Home() {
  return (
    <>
      <Nav />
      <PromoBar />
      <main>
        <Hero />
        <BrandsRow />
        <PainPoints />
        <Solution />
        <HowItWorks />
        <OfferList />
        <Faq />
        <Reviews />
        <ServicePicker />
        <AreasCovered />
        <FinalCta />
      </main>
      <Footer />
      <JsonLd data={faqPageJsonLd(faqs.homes)} />
    </>
  );
}
