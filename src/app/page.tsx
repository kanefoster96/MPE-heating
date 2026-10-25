import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { BoilerExtras } from "@/components/BoilerExtras";
import { ServiceTiles } from "@/components/ServiceTiles";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { AreasCovered } from "@/components/AreasCovered";
import { ClosingCard } from "@/components/ClosingCard";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { faqs } from "@/lib/content";
import { faqPageJsonLd } from "@/lib/seo";

const HOME_FAQS = 4;

// One job up top: a call-out for a broken-down boiler, with the £50
// explained. Then how it works, the 5-star rating, new boilers and
// servicing as their own small sections, the other trades, the top
// questions, the towns we cover (for search), and the ask once more.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Reviews />
        <BoilerExtras />
        <ServiceTiles />
        <Faq limit={HOME_FAQS} />
        <AreasCovered />
        <ClosingCard />
      </main>
      <Footer />
      <JsonLd data={faqPageJsonLd(faqs.homes.slice(0, HOME_FAQS))} />
    </>
  );
}
