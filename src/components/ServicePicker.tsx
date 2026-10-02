import Link from "next/link";
import { services, servicePicker } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";
import { ArrowRightIcon } from "./icons";

// A card with pills to choose from, each linking to its page. Rounded tags
// in grey; the first (the main service) is navy with white text.
export function ServicePicker() {
  const pills = [
    ...services.map((s) => ({ label: s.eyebrow, href: s.href })),
    servicePicker.commercialPill,
  ];

  return (
    <section className="bg-cream py-14 lg:py-28">
      <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[28px] border border-line bg-white p-7 shadow-[0_24px_50px_-32px_rgba(31,42,58,0.3)] sm:p-10 lg:flex lg:items-center lg:gap-16 lg:p-14">
          <div className="lg:w-2/5">
            <Eyebrow>Services</Eyebrow>
            <Heading
              lead={servicePicker.heading.lead}
              em={servicePicker.heading.em}
              className="mt-3 text-3xl sm:text-4xl"
            />
            <p className="mt-4 text-base leading-relaxed text-text-2">{servicePicker.text}</p>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2.5 lg:mt-0 lg:flex-1">
            {pills.map((pill, i) => (
              <li key={pill.label}>
                <Link
                  href={pill.href}
                  className={`group inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    i === 0
                      ? "bg-navy text-white hover:bg-navy-light"
                      : "bg-grey text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {pill.label}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
