import Link from "next/link";
import { problemFix } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./Reveal";

// Split layout, no boxes: the heading and the ask on the left (sticky on
// desktop), a before/after table on the right. Each row is the worry,
// struck through, then what we do instead.
export function ProblemFix() {
  return (
    <section className="bg-page py-14 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-5 lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:col-span-2 lg:self-start">
          <Eyebrow>We get it</Eyebrow>
          <Heading lead={problemFix.heading.lead} em={problemFix.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
          <Link
            href="/emergency"
            className="bg-btn-gradient mt-8 hidden min-h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white lg:inline-flex"
          >
            Book a same-day call-out
          </Link>
        </Reveal>

        <Reveal className="lg:col-span-3">
          <div className="hidden grid-cols-2 gap-6 border-b border-navy pb-3 text-xs font-bold uppercase tracking-[0.18em] text-text-3 sm:grid">
            <span>The usual</span>
            <span>With MPE</span>
          </div>
          <ul className="divide-y divide-line">
            {problemFix.items.map((item) => (
              <li key={item.fix} className="grid gap-1 py-5 sm:grid-cols-2 sm:gap-6">
                <p className="text-base text-text-3 line-through decoration-text-3/50">{item.worry}</p>
                <div>
                  <p className="flex items-center gap-2 text-lg font-bold leading-tight text-navy">
                    <ArrowRightIcon className="h-4 w-4 shrink-0 sm:hidden" />
                    {item.fix}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-text-2">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/emergency"
            className="bg-btn-gradient mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white lg:hidden"
          >
            Book a same-day call-out
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
