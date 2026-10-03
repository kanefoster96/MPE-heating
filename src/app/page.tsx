import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { ServiceTiles } from "@/components/ServiceTiles";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { AreasCovered } from "@/components/AreasCovered";
import { ClosingCard } from "@/components/ClosingCard";
import { Footer } from "@/components/Footer";
import { MobileBar } from "@/components/MobileBar";
import { JsonLd } from "@/components/JsonLd";
import { faqs } from "@/lib/content";
import { faqPageJsonLd } from "@/lib/seo";

const HOME_FAQS = 4;

// The "ticket" layout: navy strip, the £50 / £0 ticket hero, how it works
// on one card, the real TrustATrader rating, the four trades, then the top questions and the towns we
// cover (kept for search), and a navy card with the ask once more. Phones
// get a fixed Call / Chat / Book bar.
export default function Home() {
  return (
    <>
      <Nav />
      <PromoBar />
      <main>
        <Hero />
        <HowItWorks />
        <Reviews />
        <ServiceTiles />
        <Faq limit={HOME_FAQS} />
        <AreasCovered />
        <ClosingCard />
      </main>
      <Footer />
      <MobileBar />
      <JsonLd data={faqPageJsonLd(faqs.homes.slice(0, HOME_FAQS))} />
    </>
  );
}
