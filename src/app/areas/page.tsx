import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { MapPinIcon, ArrowRightIcon } from "@/components/icons";
import { areaPages } from "@/lib/areas";
import { business } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Areas We Cover",
  description: `Gas Safe registered boiler repairs, servicing and new installs across ${business.region} — find your area for local response times and coverage.`,
  alternates: { canonical: `${SITE_URL}/areas` },
  openGraph: { url: `${SITE_URL}/areas` },
};

export default function AreasIndexPage() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<MapPinIcon className="h-full w-full" />}
          eyebrow="Areas We Cover"
          headline="Boiler engineers across the North East"
          subline="Based in Whitley Bay, covering towns and villages across Tyne and Wear, Northumberland and beyond. Find your area below."
          cta="Book a visit"
          ticks={["Gas Safe registered", "£50 call-out refunded when fixed", "30-day guarantee"]}
        />

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {areaPages.map((area) => (
                <Link
                  key={area.slug}
                  href={`/areas/${area.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl bg-grey px-6 py-5 transition-colors hover:bg-grey/70"
                >
                  <span className="text-base font-bold text-navy">{area.name}</span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-terracotta transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-navy/60">
              Don&rsquo;t see your area listed?{" "}
              <Link href="/contact" className="font-semibold text-terracotta hover:underline">
                Get in touch
              </Link>{" "}
              — we cover the wider North East beyond this list too.
            </p>
          </div>
        </section>

        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
