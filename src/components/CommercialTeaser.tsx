import { commercial, business } from "@/lib/content";
import { BuildingIcon, ArrowRightIcon } from "./icons";
import { ProductArt } from "./ProductArt";

export function CommercialTeaser() {
  return (
    <section className="bg-cream py-4 sm:py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-8 rounded-[28px] bg-blue px-6 py-10 text-center sm:flex-row sm:justify-between sm:px-12 sm:py-12 sm:text-left">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <ProductArt icon={<BuildingIcon className="h-full w-full" />} size="sm" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                {commercial.label}
              </p>
              <h2 className="mt-2 max-w-md text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {commercial.headline}
              </h2>
            </div>
          </div>
          <a
            href={`mailto:${business.email}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue transition-colors hover:bg-white/90"
          >
            {commercial.cta}
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
