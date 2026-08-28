import Link from "next/link";
import { business } from "@/lib/content";
import { areaPages } from "@/lib/areas";

// Every town in business.areasList now has its own page (src/lib/areas.ts)
// — this map is built from that list rather than hand-maintained, so a
// new area page ships already linked here.
const areaPageSlugs: Record<string, string> = Object.fromEntries(
  areaPages.map((area) => [area.name, `/areas/${area.slug}`])
);

export function AreasCovered() {
  const towns = business.areasList;

  return (
    <section className="bg-cream py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-grey px-6 py-4 text-center">
          <p className="text-sm text-navy/60">
            We operate across all areas in the North East, including{" "}
            {towns.map((town, i) => {
              const href = areaPageSlugs[town];
              const label = href ? (
                <Link key={town} href={href} className="font-semibold text-terracotta hover:underline">
                  {town}
                </Link>
              ) : (
                <span key={town}>{town}</span>
              );
              const separator = i === towns.length - 1 ? "" : i === towns.length - 2 ? " and " : ", ";
              return (
                <span key={`${town}-wrap`}>
                  {label}
                  {separator}
                </span>
              );
            })}
            . See our{" "}
            <Link href="/areas" className="font-semibold text-terracotta hover:underline">
              full areas we cover page
            </Link>{" "}
            for local details on each.
          </p>
        </div>
      </div>
    </section>
  );
}
