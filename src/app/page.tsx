import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { Hero } from "@/components/Hero";
import { BrandsRow } from "@/components/BrandsRow";
import { StoryCards } from "@/components/StoryCards";
import { HowItWorks } from "@/components/HowItWorks";
import { ServicePicker } from "@/components/ServicePicker";
import { PromiseTiles } from "@/components/PromiseTiles";
import { OfferList } from "@/components/OfferList";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { AreasCovered } from "@/components/AreasCovered";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

// Page order: hero and the main ask; how it works 1, 2, 3 (the process and
// the £50 call-out, before anyone books); story cards; pick a service; the
// promise; the one list (the repair offer); reviews; questions; the ask.
export default function Home() {
  return (
    <>
      <Nav />
      <PromoBar />
      <main>
        <Hero />
        <BrandsRow />
        <HowItWorks />
        <StoryCards />
        <ServicePicker />
        <PromiseTiles />
        <OfferList />
        <Reviews />
        <Faq />
        <AreasCovered />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
