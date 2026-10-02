import { Nav } from "@/components/Nav";
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

// Page order: hero and the main ask; story cards (what happens when you
// book); how it works 1, 2, 3; pick a service; the promise; the one list
// (the repair offer); reviews; questions; the ask again.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <BrandsRow />
        <StoryCards />
        <HowItWorks />
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
