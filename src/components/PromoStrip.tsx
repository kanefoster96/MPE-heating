import { business, promo } from "@/lib/content";

export function PromoStrip() {
  return (
    <div className="bg-[#F5C244]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-2.5 text-sm sm:flex-row sm:px-6">
        <p className="font-medium text-navy text-center sm:text-left">{promo.text}</p>
        <a
          href={business.phoneHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
        >
          {promo.cta}
        </a>
      </div>
    </div>
  );
}
