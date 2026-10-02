import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ServicePageHero } from "@/components/ServicePageHero";
import { Reviews } from "@/components/Reviews";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import {
  BoilerIcon,
  ServiceIcon,
  NewBoilerIcon,
  BuildingIcon,
  ArrowRightIcon,
  VanIcon,
} from "@/components/icons";
import { Heading, Eyebrow } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import { guarantee } from "@/lib/content";
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
  { icon: BoilerIcon, href: "/boiler-repair", title: "Boiler Repairs", text: "Same day where we can, £50 call-out refunded when fixed." },
  { icon: ServiceIcon, href: "/servicing", title: "Boiler Servicing", text: "Annual service from £79, keeps your warranty valid." },
  { icon: NewBoilerIcon, href: "/new-boilers", title: "New Boilers", text: "Free fixed-price quote, usually fitted in a day." },
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
      <main>
        <ServicePageHero
          icon={<BoilerIcon />}
          eyebrow={area.name}
          headline={{ lead: `Boiler repairs in ${area.name}.`, em: "Same day where we can." }}
          status={`Covering ${area.name} from Whitley Bay`}
          subline={area.subline}
          cta={`Book a repair in ${area.name}`}
          type="repair"
          reassurance="£50 call-out, 100% off your bill when fixed. Price agreed before we start. Every repair guaranteed for 3 months."
        />

        <section className="bg-cream py-14 lg:py-28">
          <Reveal className="mx-auto max-w-2xl px-4 sm:px-6">
            <p className="mb-5 text-sm font-medium text-text-3">{area.distance}</p>
            <div className="flex flex-col gap-5">
              {area.intro.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-navy/80">
                  {paragraph}
                </p>
              ))}
            </div>

            {nearbyAreas.length > 0 ? (
              <p className="mt-6 text-sm text-text-2">
                We also cover{" "}
                {nearbyAreas.map((a, i) => (
                  <span key={a.slug}>
                    <Link href={`/areas/${a.slug}`} className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
                      {a.name}
                    </Link>
                    {i < nearbyAreas.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                and the wider North East.
              </p>
            ) : (
              <p className="mt-6 text-sm text-text-2">
                Part of our wider North East coverage — see the full list of{" "}
                <Link href="/areas" className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
                  areas we cover
                </Link>
                .
              </p>
            )}
          </Reveal>
        </section>

        <section className="bg-page py-14 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>In {area.name}</Eyebrow>
              <Heading lead="Services in your area." em="All the same promise." className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
            </Reveal>

            <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {serviceLinks.map(({ icon: Icon, href, title, text }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col rounded-[24px] border border-line bg-cream p-6 transition-colors hover:bg-grey"
                >
                  <div className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white text-navy">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-navy">{title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-text-2">{text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
                    Learn more
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </Reveal>

            <p className="mt-8 flex items-start gap-3 text-base leading-relaxed text-text-2">
              <VanIcon className="mt-1 h-5 w-5 shrink-0 text-navy" />
              Our engineers carry common parts on the van, so most {area.name} repairs are sorted
              in one visit rather than needing a return trip. {guarantee.text}
            </p>
          </div>
        </section>

        <section className="bg-cream py-14 lg:py-28">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>Common questions</Eyebrow>
              <Heading lead={`${area.name}.`} em="Asked and answered." className="mt-3 text-3xl sm:text-4xl" />
            </Reveal>

            <Reveal className="mt-8 flex flex-col gap-3">
              {area.faqs.map((item) => (
                <div key={item.q} className="rounded-2xl border border-line bg-white px-5 py-4">
                  <p className="text-base font-semibold text-navy">{item.q}</p>
                  <p className="mt-1.5 text-base leading-relaxed text-text-2">{item.a}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <Reviews />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
