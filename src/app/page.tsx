import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { Hero } from "@/components/Hero";
import { BrandsMarquee } from "@/components/BrandsMarquee";
import { AccreditationStrip } from "@/components/AccreditationStrip";
import { ServiceCards } from "@/components/ServiceCards";
import { WhyMpe } from "@/components/WhyMpe";
import { HowItWorks } from "@/components/HowItWorks";
import { GuaranteeBlock } from "@/components/GuaranteeBlock";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { CommercialTeaser } from "@/components/CommercialTeaser";
import { AreasCovered } from "@/components/AreasCovered";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";

export default function Home() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <Hero />
        <BrandsMarquee />
        <AccreditationStrip />
        <ServiceCards />
        <WhyMpe />
        <HowItWorks />
        <GuaranteeBlock />
        <Reviews />
        <Faq />
        <CommercialTeaser />
        <AreasCovered />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
