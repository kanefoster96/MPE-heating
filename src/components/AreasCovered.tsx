import Link from "next/link";
import { business } from "@/lib/content";
import { areaPages } from "@/lib/areas";

// One sentence listing the towns, each linked to its page. Built from the
// area list so a new area page ships already linked here.
const areaPageSlugs: Record<string, string> = Object.fromEntries(
  areaPages.map((area) => [area.name, `/areas/${area.slug}`])
);

const linkClass = "font-semibold text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy";

export function AreasCovered() {
  const towns = business.areasList;

  return (
    <section className="bg-cream py-10">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="text-sm leading-relaxed text-text-2">
          Across the North East, including{" "}
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
      </div>
    </section>
  );
}
