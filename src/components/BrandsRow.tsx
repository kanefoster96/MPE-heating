import { boilerBrands, accreditations } from "@/lib/content";

// A quiet static row: the brands we install and the marks we hold. Nothing
// loops on the page.
export function BrandsRow() {
  return (
    <section className="border-y border-line bg-page py-7">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:px-6 lg:flex-row lg:justify-between">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2" aria-label="Brands we install">
          {boilerBrands.map((brand) => (
            <li key={brand} className="text-base font-bold tracking-tight text-navy/35 sm:text-lg">
              {brand}
            </li>
          ))}
        </ul>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-text-3 sm:block">
          {accreditations.join(" · ")}
        </p>
      </div>
    </section>
  );
}
