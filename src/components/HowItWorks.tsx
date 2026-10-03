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

        <Reveal as="ol" className="mt-10 grid gap-4 sm:grid-cols-3">
          {howItWorks.steps.map((step) => (
            <li key={step.number} className="rounded-[24px] border border-line bg-white p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                {step.number}
              </span>
              <h3 className="mt-5 text-lg font-bold leading-tight text-navy">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{step.text}</p>
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
