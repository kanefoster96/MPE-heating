import Link from "next/link";
import { problemFix } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { Heading, Eyebrow } from "./Heading";
import { IconTile } from "./IconTile";
import { Reveal } from "./Reveal";

// The worry, struck through, and what we do instead. Four short cards and
// one button.
export function ProblemFix() {
  return (
    <section className="bg-page py-14 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>We get it</Eyebrow>
          <Heading lead={problemFix.heading.lead} em={problemFix.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
        </Reveal>

        <Reveal className="mt-8 grid grid-cols-2 gap-3 lg:mt-10 lg:grid-cols-4">
          {problemFix.items.map((item) => {
            const Icon = featureIconMap[item.icon];
            return (
              <div key={item.fix} className="rounded-[24px] border border-line bg-cream p-4 sm:p-5">
                <IconTile icon={<Icon />} primary className="hidden sm:grid" />
                <p className="text-xs text-text-3 line-through decoration-text-3/60 sm:mt-4 sm:text-sm">{item.worry}</p>
                <h3 className="mt-1 text-base font-bold leading-tight text-navy sm:text-lg">{item.fix}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-2 sm:text-sm">{item.text}</p>
              </div>
            );
          })}
        </Reveal>

        <Reveal className="mt-8">
          <Link
            href="/emergency"
            className="bg-btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
          >
            Book a same-day call-out
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
