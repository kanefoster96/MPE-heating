import Link from "next/link";
import { howItWorks } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

// How it works, 1, 2, 3: three short steps in a row, then the ask.
export function HowItWorks() {
  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>How easy it is</Eyebrow>
          <Heading
            lead={howItWorks.heading.lead}
            em={howItWorks.heading.em}
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl"
          />
        </Reveal>

        <Reveal as="ol" className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
          {howItWorks.steps.map((step) => (
            <li
              key={step.number}
              className="flex gap-4 rounded-[24px] border border-line bg-white p-4 sm:block sm:p-6"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                {step.number}
              </span>
              <span className="block">
                <h3 className="text-base font-bold leading-tight text-navy sm:mt-5 sm:text-lg">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-2 sm:mt-2">{step.text}</p>
              </span>
            </li>
          ))}
        </Reveal>

        <Reveal className="mt-8">
          <Link
            href={contactHref("repair")}
            className="bg-btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
          >
            Book a same-day call-out
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
