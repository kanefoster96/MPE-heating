import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { HomeMore } from "@/components/HomeMore";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { AreasCovered } from "@/components/AreasCovered";
import { ClosingCard } from "@/components/ClosingCard";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { faqs } from "@/lib/content";
import { faqPageJsonLd } from "@/lib/seo";

const HOME_FAQS = 4;

// One job up top: a call-out for a broken-down boiler, with how it works
// beside it. Then the 5-star rating, everything else as one list of rows,
// the top questions, the towns we cover (for search), and the ask once
// more. One orange button (twice), and the £50 said twice.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Reviews tone="cream" />
        <HomeMore />
        <Faq limit={HOME_FAQS} />
        <AreasCovered />
        <ClosingCard />
      </main>
      <Footer freeBand={false} />
      <JsonLd data={faqPageJsonLd(faqs.homes.slice(0, HOME_FAQS))} />
    </>
  );
}
