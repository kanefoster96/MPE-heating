import Link from "next/link";
import { business, hero } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { CheckIcon } from "./icons";
import { Stars } from "./Stars";

// The hero sells one thing: a same-day call-out for a broken-down boiler.
// Left: the two-tone headline, one line of copy, the one big button (the
// only orange button on the page), the number, and a quiet row of proof.
// Right (under it on a phone): what happens, in three steps on a white
// card. The £50 is said twice: in the line of copy and in step three.
export function Hero() {
  return (
    <section className="overflow-x-clip bg-page pt-10 pb-12 sm:pt-14 lg:pt-[72px] lg:pb-24">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16 lg:text-left">
        <div className="flex flex-col items-center lg:items-start">
          <h1 className="max-w-[14ch] text-[44px] font-bold leading-[1.02] tracking-[-0.045em] [text-wrap:balance] sm:text-[64px] lg:max-w-[13ch] lg:text-[clamp(56px,5.2vw,74px)]">
            {hero.headline.lead} <span className="em block">{hero.headline.em}</span>
          </h1>

          <p className="mt-5 max-w-[560px] text-lg leading-normal text-text-2 sm:text-xl">{hero.subline}</p>

          <div className="mt-7 w-full max-w-[430px]">
            <Link
              href={contactHref("repair")}
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(100deg,var(--color-terracotta-deep),#c24e1c)] px-6 text-[17px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(181,65,28,0.7)] transition-[filter] hover:brightness-95"
            >
              {hero.cta}
            </Link>
            <a href={business.phoneHref} className="mt-1.5 inline-flex min-h-11 items-center text-[15px] font-semibold text-navy">
              or call {business.phoneDisplay}
            </a>
          </div>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-2 lg:justify-start">
            {hero.trust.map((item, i) => (
              <li key={item} className="flex items-center gap-1.5">
                {i === 0 ? <Stars size="h-3.5 w-3.5" /> : <CheckIcon className="h-4 w-4 text-whatsapp-dark" strokeWidth={3} aria-hidden="true" />}
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[440px] text-left lg:mt-0">
          <div className="rounded-[22px] border-[1.5px] border-edge bg-white px-5 pt-5 pb-3 shadow-[0_18px_40px_-26px_rgba(31,42,58,0.35)] sm:px-6">
            <h2 className="text-xl font-extrabold tracking-[-0.02em]">{hero.steps.heading}</h2>
            <ol className="mt-1">
              {hero.steps.items.map((step, i) => (
                <li key={step.title} className={`flex gap-3.5 py-3.5 ${i ? "border-t border-edge" : ""}`}>
                  <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-navy text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-base font-bold leading-snug">{step.title}</span>
                    <span className="mt-0.5 block text-[15px] leading-snug text-text-2">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
