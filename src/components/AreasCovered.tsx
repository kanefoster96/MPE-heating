import Link from "next/link";
import { business } from "@/lib/content";
import { areaPages } from "@/lib/areas";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

// One sentence listing the towns, each linked to its page. Built from the
// area list so a new area page ships already linked here.
const areaPageSlugs: Record<string, string> = Object.fromEntries(
  areaPages.map((area) => [area.name, `/areas/${area.slug}`])
);

const linkClass = "font-semibold text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy";

export function AreasCovered() {
  const towns = business.areasList;

  return (
    <section className="bg-cream py-14 lg:py-28">
      <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Eyebrow>Areas we cover</Eyebrow>
        <Heading
          lead={`Boiler repairs near you.`}
          em={`${business.base} and across the North East.`}
          emLine
          className="mt-3 text-3xl sm:text-4xl"
        />
        <p className="mt-5 text-base leading-relaxed text-text-2">
          Based in {business.base}, covering{" "}
          {towns.map((town, i) => {
            const href = areaPageSlugs[town];
            const separator = i === towns.length - 1 ? "" : i === towns.length - 2 ? " and " : ", ";
            return (
              <span key={town}>
                {href ? (
                  <Link href={href} className={linkClass}>
                    {town}
                  </Link>
                ) : (
                  town
                )}
                {separator}
              </span>
            );
          })}
          . See every{" "}
          <Link href="/areas" className={linkClass}>
            area we cover
          </Link>
          .
        </p>
      </Reveal>
    </section>
  );
}
