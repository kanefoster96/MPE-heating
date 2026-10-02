import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
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
      <main>
        <ServicePageHero
          icon={<MapPinIcon />}
          eyebrow="Areas we cover"
          headline={{ lead: "Boiler engineers across the North East.", em: "Same day where we can." }}
          status="Based in Whitley Bay"
          subline="Towns and villages across Tyne and Wear, Northumberland and beyond. Find your area for local detail."
          cta="Book a same-day visit"
          type="repair"
          reassurance="£50 call-out, 100% off your bill when fixed. Price agreed before we start. Every repair guaranteed for 3 months."
        />

        <section className="bg-cream py-14 lg:py-28">
          <Reveal className="mx-auto max-w-5xl px-4 sm:px-6">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {areaPages.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={`/areas/${area.slug}`}
                    className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-white px-6 py-4 transition-colors hover:bg-grey"
                  >
                    <span className="text-base font-bold text-navy">{area.name}</span>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-navy transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-center text-sm text-text-2">
              Don&rsquo;t see your area?{" "}
              <Link href="/contact" className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
                Get in touch
              </Link>
              . We cover the wider North East beyond this list.
            </p>
          </Reveal>
        </section>

        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
