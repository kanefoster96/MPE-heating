import Link from "next/link";
import { commercialPush } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./Reveal";

const WHAT = ["Catering equipment", "Commercial boilers", "Gas safety & EICR", "Maintenance contracts"];

// Split layout for business owners: the pitch and two buttons on one side,
// what we cover set large on the other, each line linking into the
// commercial branch of the booking funnel.
export function CommercialBanner() {
  const c = commercialPush;
  return (
    <section className="border-y border-line bg-page py-14 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Heading lead={c.heading.lead} em={c.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-text-2">{c.text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={c.href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-navy-light"
            >
              {c.cta}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href={c.secondary.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-navy/20 px-7 text-base font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              {c.secondary.label}
            </Link>
          </div>
        </Reveal>

        <Reveal as="ul" className="divide-y divide-line border-y border-line">
          {WHAT.map((label) => (
            <li key={label}>
              <Link
                href={c.href}
                className="group flex min-h-16 items-center justify-between gap-4 py-4 text-2xl font-extrabold tracking-tight text-navy transition-colors hover:text-terracotta-dark sm:text-3xl"
              >
                {label}
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-navy/40 transition-transform group-hover:translate-x-1 group-hover:text-terracotta-dark" />
              </Link>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
