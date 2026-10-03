import Link from "next/link";
import { commercialPush } from "@/lib/content";
import { IconTile } from "./IconTile";
import { ArrowRightIcon, BuildingIcon } from "./icons";
import { Reveal } from "./Reveal";

// A navy band pushing commercial cover to business owners, with two clear
// actions: book, or read more first.
export function CommercialBanner() {
  const c = commercialPush;
  return (
    <section className="bg-page py-14 lg:py-20">
      <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[28px] bg-navy p-7 text-white sm:p-10 lg:flex lg:items-center lg:gap-16 lg:p-14">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <IconTile icon={<BuildingIcon />} className="bg-white/10 text-white" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{c.eyebrow}</p>
            </div>
            <h2 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
              {c.heading.lead}
              <span className="block text-white/70">{c.heading.em}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75">{c.text}</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
            <Link
              href={c.href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-navy transition-colors hover:bg-cream"
            >
              {c.cta}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href={c.secondary.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              {c.secondary.label}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
