import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { GuaranteeBlock } from "@/components/GuaranteeBlock";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import {
  BoilerIcon,
  ServiceIcon,
  NewBoilerIcon,
  BuildingIcon,
  ArrowRightIcon,
} from "@/components/icons";
import { whitleyBayPage } from "@/lib/areas";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Boiler Repairs in ${whitleyBayPage.name}`,
  description: whitleyBayPage.subline,
  alternates: { canonical: `${SITE_URL}/areas/${whitleyBayPage.slug}` },
  openGraph: { url: `${SITE_URL}/areas/${whitleyBayPage.slug}` },
};

const serviceLinks = [
  { icon: BoilerIcon, href: "/boiler-repair", title: "Boiler Repairs", text: "Same-day response, £50 call-out refunded when fixed." },
  { icon: ServiceIcon, href: "/servicing", title: "Boiler Servicing", text: "Annual service from £79, keeps your warranty valid." },
  { icon: NewBoilerIcon, href: "/new-boilers", title: "New Boilers", text: "Free quotes, fixed price, fitted by a Gas Safe engineer." },
  { icon: BuildingIcon, href: "/commercial", title: "Commercial", text: "Gas, catering equipment and EICR for local businesses." },
];

export default function WhitleyBayPage() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<BoilerIcon className="h-full w-full" />}
          eyebrow={whitleyBayPage.name}
          headline={whitleyBayPage.headline}
          subline={whitleyBayPage.subline}
          cta="Book a repair in Whitley Bay"
          ticks={["Gas Safe registered", "£50 call-out refunded when fixed", "30-day guarantee"]}
        />

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="flex flex-col gap-5">
              {whitleyBayPage.intro.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-navy/80">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="mt-6 text-sm text-navy/50">
              We also cover {whitleyBayPage.nearby.join(", ")} and the wider North East.
            </p>
          </div>
        </section>

        <section className="bg-cream py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
                In {whitleyBayPage.name}
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                Services available in your area
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {serviceLinks.map(({ icon: Icon, href, title, text }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col rounded-[24px] bg-white p-6 shadow-[0_10px_25px_-18px_rgba(31,42,58,0.3)] transition-shadow hover:shadow-[0_15px_30px_-15px_rgba(31,42,58,0.35)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-grey text-terracotta">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-navy">{title}</h3>
                  <p className="mt-1.5 flex-1 text-sm text-navy/70">{text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta">
                    Learn more
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <GuaranteeBlock />
        <Reviews />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
