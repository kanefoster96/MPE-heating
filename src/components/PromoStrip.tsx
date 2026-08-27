import { business, promo } from "@/lib/content";

export function PromoStrip() {
  return (
    <div className="bg-[#F5C244]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="min-w-0 truncate text-xs font-medium text-navy sm:text-sm">{promo.text}</p>
        <a
          href={business.phoneHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-light sm:text-sm"
        >
          {promo.cta}
        </a>
      </div>
    </div>
  );
}
