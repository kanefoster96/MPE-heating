import type { ReactNode } from "react";
import Link from "next/link";
import { ProductArt } from "./ProductArt";
import { CheckIcon } from "./icons";

// Hero for the service sub-pages (boiler repair, servicing, etc.) — mirrors
// the homepage Hero's flame-gradient band + white card layout, but with a
// ProductArt icon placeholder instead of the real boiler photo, since we
// don't have real photography for every service yet.
export function ServicePageHero({
  icon,
  eyebrow,
  headline,
  subline,
  cta,
  ticks,
}: {
  icon: ReactNode;
  eyebrow: string;
  headline: string;
  subline: string;
  cta: string;
  ticks: string[];
}) {
  return (
    <section className="relative overflow-hidden bg-flame-gradient">
      <div className="mx-auto flex max-w-6xl justify-center px-4 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
        <ProductArt icon={icon} size="lg" className="-rotate-3" />
      </div>

      <div className="relative mx-auto -mt-2 max-w-6xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="rounded-t-[28px] bg-white px-5 py-8 shadow-[0_-15px_35px_-20px_rgba(31,42,58,0.3)] sm:rounded-[28px] sm:px-10 sm:py-10 lg:mx-auto lg:max-w-2xl lg:text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl lg:text-5xl">
            {headline}
          </h1>
          <p className="mt-4 text-base text-navy/70 sm:text-lg">{subline}</p>

          <Link
            href="/contact"
            className="bg-btn-gradient mt-6 block w-full rounded-full py-4 text-center text-base font-semibold text-white shadow-[0_12px_25px_-10px_rgba(232,98,58,0.7)]"
          >
            {cta}
          </Link>

          <ul className="mt-6 flex flex-col gap-2 text-sm text-navy/80 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
            {ticks.map((t) => (
              <li key={t} className="flex items-center gap-2 sm:justify-center">
                <CheckIcon className="h-4 w-4 shrink-0 text-terracotta" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
