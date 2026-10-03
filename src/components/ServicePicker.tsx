import Link from "next/link";
import { services, servicePicker } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";
import { ArrowRightIcon, BuildingIcon } from "./icons";
import { IconTile } from "./IconTile";

// All services as pills, each linking to its page, then a push for
// business owners.
export function ServicePicker() {
  const pills = [
    ...services.map((s) => ({ label: s.eyebrow, href: s.href })),
    servicePicker.commercialPill,
  ];
  const c = servicePicker.commercial;

  return (
    <section className="bg-page py-14 lg:py-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6">
        <Reveal className="rounded-[28px] border border-line bg-white p-7 shadow-[0_24px_50px_-32px_rgba(31,42,58,0.3)] sm:p-10 lg:flex lg:items-center lg:gap-16 lg:p-14">
          <div className="lg:w-2/5">
            <Eyebrow>All services</Eyebrow>
            <Heading lead={servicePicker.heading.lead} em={servicePicker.heading.em} className="mt-3 text-3xl sm:text-4xl" />
            <p className="mt-4 text-base leading-relaxed text-text-2">{servicePicker.text}</p>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2.5 lg:mt-0 lg:flex-1">
            {pills.map((pill, i) => (
              <li key={pill.label}>
                <Link
                  href={pill.href}
                  className={`group inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    i === 0 ? "bg-navy text-white hover:bg-navy-light" : "bg-grey text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {pill.label}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="rounded-[28px] border border-line bg-navy p-7 text-white sm:p-10 lg:flex lg:items-center lg:gap-16 lg:p-14">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <IconTile icon={<BuildingIcon />} className="bg-white/10 text-white" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{c.eyebrow}</p>
            </div>
            <h2 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
              {c.heading.lead} <span className="block text-white/70">{c.heading.em}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75">{c.text}</p>
          </div>
          <Link
            href={c.href}
            className="mt-8 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-navy transition-colors hover:bg-cream lg:mt-0"
          >
            {c.cta}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
