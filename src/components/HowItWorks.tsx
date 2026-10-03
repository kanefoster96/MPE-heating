import Link from "next/link";
import { howItWorks } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

// A timeline, not boxes: numbered dots joined by a line. Horizontal on
// desktop, vertical on a phone.
export function HowItWorks() {
  return (
    <section className="bg-cream py-14 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>How easy it is</Eyebrow>
          <Heading lead={howItWorks.heading.lead} em={howItWorks.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
        </Reveal>

        <Reveal as="ol" className="relative mt-10 grid gap-8 lg:mt-14 lg:grid-cols-3 lg:gap-10">
          {/* The connecting line: down the left on phones, across the top on desktop. */}
          <span aria-hidden="true" className="absolute bottom-2 left-[19px] top-2 w-px bg-navy/20 lg:hidden" />
          <span aria-hidden="true" className="absolute left-5 right-5 top-5 hidden h-px bg-navy/20 lg:block" />
          {howItWorks.steps.map((step) => (
            <li key={step.number} className="relative flex gap-5 lg:block">
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-base font-bold text-white ring-8 ring-cream">
                {step.number}
              </span>
              <span className="block lg:mt-6">
                <h3 className="text-xl font-extrabold leading-tight tracking-tight text-navy">{step.title}</h3>
                <p className="mt-2 max-w-sm text-base leading-relaxed text-text-2">{step.text}</p>
              </span>
            </li>
          ))}
        </Reveal>

        <Reveal className="mt-10 lg:mt-12">
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
