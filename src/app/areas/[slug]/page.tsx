import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  VanIcon,
} from "@/components/icons";
import { areaPages, getAreaPage } from "@/lib/areas";
import { SITE_URL } from "@/lib/seo";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return areaPages.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getAreaPage(slug);
  if (!area) return {};

  return {
    title: `Boiler Repairs in ${area.name}`,
    description: area.subline,
    alternates: { canonical: `${SITE_URL}/areas/${area.slug}` },
    openGraph: { url: `${SITE_URL}/areas/${area.slug}` },
  };
}

const serviceLinks = [
  { icon: BoilerIcon, href: "/boiler-repair", title: "Boiler Repairs", text: "Same-day response, £50 call-out refunded when fixed." },
  { icon: ServiceIcon, href: "/servicing", title: "Boiler Servicing", text: "Annual service from £79, keeps your warranty valid." },
  { icon: NewBoilerIcon, href: "/new-boilers", title: "New Boilers", text: "Free quotes, fixed price, fitted by a Gas Safe engineer." },
  { icon: BuildingIcon, href: "/commercial", title: "Commercial", text: "Gas, catering equipment and EICR for local businesses." },
];

export default async function AreaPageRoute({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const area = getAreaPage(slug);
  if (!area) notFound();

  const nearbyAreas = area.nearby.map((s) => getAreaPage(s)).filter((a) => a !== undefined);

  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<BoilerIcon className="h-full w-full" />}
          eyebrow={area.name}
          headline={area.headline}
          subline={area.subline}
          cta={`Book a repair in ${area.name}`}
          ticks={["Gas Safe registered", "£50 call-out refunded when fixed", "30-day guarantee"]}
        />

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <p className="inline-flex rounded-full bg-grey px-4 py-2 text-xs font-semibold text-navy/70">
              {area.distance}
            </p>

            <div className="mt-6 flex flex-col gap-5">
              {area.intro.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-navy/80">
                  {paragraph}
                </p>
              ))}
            </div>

            {nearbyAreas.length > 0 ? (
              <p className="mt-6 text-sm text-navy/50">
                We also cover{" "}
                {nearbyAreas.map((a, i) => (
                  <span key={a.slug}>
                    <Link href={`/areas/${a.slug}`} className="font-semibold text-terracotta hover:underline">
                      {a.name}
                    </Link>
                    {i < nearbyAreas.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                and the wider North East.
              </p>
            ) : (
              <p className="mt-6 text-sm text-navy/50">
                Part of our wider North East coverage — see the full list of{" "}
                <Link href="/areas" className="font-semibold text-terracotta hover:underline">
                  areas we cover
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        <section className="bg-cream py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
                In {area.name}
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

            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-terracotta-light px-5 py-4 text-sm leading-relaxed text-navy/80">
              <VanIcon className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
              Our engineers carry common parts on the van, so most {area.name} repairs are sorted
              in one visit rather than needing a return trip.
            </div>
          </div>
        </section>

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="mb-8 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
                Common Questions
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                {area.name} FAQs
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {area.faqs.map((item) => (
                <div key={item.q} className="rounded-2xl bg-grey px-5 py-4">
                  <p className="text-sm font-semibold text-navy sm:text-base">{item.q}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-navy/70">{item.a}</p>
                </div>
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
