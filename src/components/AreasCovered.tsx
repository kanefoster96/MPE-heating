import Link from "next/link";
import { business } from "@/lib/content";
import { areaPages } from "@/lib/areas";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";
import { MapPinIcon } from "./icons";

// Every town as a tappable chip linking to its page. Built from the area
// list so a new area page ships already linked here.
const areaPageSlugs: Record<string, string> = Object.fromEntries(
  areaPages.map((area) => [area.name, `/areas/${area.slug}`])
);

export function AreasCovered() {
  return (
    <section className="bg-page py-14 lg:py-24">
      <Reveal className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Eyebrow>Areas we cover</Eyebrow>
        <Heading
          lead="Boiler repairs near you."
          em={`${business.base} and across the North East.`}
          className="mt-3 text-3xl sm:text-4xl"
        />
        <ul className="mt-8 flex flex-wrap justify-center gap-2">
          {business.areasList.map((town) => {
            const href = areaPageSlugs[town] ?? "/areas";
            return (
              <li key={town}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-cream px-4 text-sm font-semibold text-navy transition-colors hover:border-navy/40"
                >
                  <MapPinIcon className="h-3.5 w-3.5 text-text-3" />
                  {town}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-text-2">
          Not listed?{" "}
          <Link href="/contact" className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
            Ask us
          </Link>
          . We cover the wider North East.
        </p>
      </Reveal>
    </section>
  );
}
