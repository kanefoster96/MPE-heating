import Link from "next/link";
import { business, hero } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { FlameIcon } from "./icons";
import { HeroPromises } from "./HeroPromises";

// The hero in the kanvas.one layout, without the phone mockup. Left: a
// proof pill (who we are, and a way to ask straight away), the two-tone
// headline with the orange clause on its own line, one line of copy, one
// big button and a line of quiet links. Right: the orange card of
// promises. Centred and stacked on a phone; two columns from 1024px.
export function Hero() {
  return (
    <section className="overflow-x-clip bg-page pt-10 pb-12 sm:pt-14 lg:pt-[72px] lg:pb-24">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16 lg:text-left">
        <div className="flex flex-col items-center lg:items-start">
          <a
            href={business.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-full bg-grey py-[5px] pr-4 pl-[5px] text-left text-sm leading-[1.3] text-text-2 transition-colors hover:bg-[#ebe8e3]"
          >
            <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[image:var(--grad)] text-white">
              <FlameIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block">{hero.proof.line1}</span>
              <span className="block font-semibold text-terracotta-deep">{hero.proof.line2} &rsaquo;</span>
            </span>
          </a>

          <h1 className="mt-5 max-w-[14ch] text-[44px] font-bold leading-[1.02] tracking-[-0.045em] [text-wrap:balance] sm:text-[64px] lg:max-w-[13ch] lg:text-[clamp(56px,5.2vw,74px)]">
            {hero.headline.lead} <span className="em block">{hero.headline.em}</span>
          </h1>

          <p className="mt-5 max-w-[600px] text-lg leading-normal text-text-2 sm:text-xl">{hero.subline}</p>

          <div className="mt-7 w-full max-w-[430px]">
            <Link
              href={contactHref("repair")}
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(100deg,var(--color-terracotta-deep),#c24e1c)] px-6 text-[17px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(181,65,28,0.7)] transition-[filter] hover:brightness-95"
            >
              {hero.cta}
            </Link>
            <p className="mt-2.5 text-[15px] text-text-2">
              <a href={business.phoneHref} className="inline-flex min-h-11 items-center font-semibold text-terracotta-deep">
                Prefer to talk first? Call {business.phoneDisplay}
              </a>
              <span aria-hidden="true"> &middot; </span>
              <a
                href={business.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center font-semibold text-navy"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[440px] lg:mt-0">
          <HeroPromises />
        </div>
      </div>
    </section>
  );
}
