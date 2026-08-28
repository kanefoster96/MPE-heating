import { business, finalCta } from "@/lib/content";
import { BoilerIcon } from "./icons";
import { ProductArt } from "./ProductArt";

export function FinalCta() {
  return (
    <section className="bg-flame-gradient py-14 sm:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <ProductArt icon={<BoilerIcon className="h-full w-full" />} size="md" className="-rotate-3" />
        <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {finalCta.headline}
        </h2>
        <a
          href={business.phoneHref}
          className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-full bg-white px-8 py-4 text-base font-semibold text-terracotta shadow-[0_12px_25px_-10px_rgba(0,0,0,0.3)] transition-colors hover:bg-white/90 sm:w-auto"
        >
          {finalCta.cta}
        </a>
        <a
          href={business.phoneHref}
          className="mt-4 text-sm font-semibold text-white/90 hover:text-white"
        >
          {business.phoneDisplay}
        </a>
      </div>
    </section>
  );
}
