import Link from "next/link";
import { business, hero, rating } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { ArrowRightIcon, CheckIcon, PhoneIcon, ShieldIcon, WhatsAppIcon } from "./icons";

// The "ticket" hero: two chips, a left-aligned headline with a highlighter
// on "today.", one paragraph, then the £50 / £0 tear-off ticket, one big
// button, call and WhatsApp, three ticks. On a phone it is one column in
// that order; on desktop the ticket moves to the right-hand column.
export function Hero() {
  const t = hero.ticket;
  return (
    <section className="overflow-x-clip bg-page">
      <div className="mx-auto grid max-w-2xl px-5 pt-7 pb-9 sm:px-6 lg:max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-x-16 lg:pt-16 lg:pb-20">
        <div className="flex flex-col gap-[18px] lg:col-start-1 lg:row-start-1 lg:self-end">
          <ul className="flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-2 text-[13px] font-semibold">
              <Stars />
              5-star rated on {rating.source}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-2 text-[13px] font-semibold">
              <ShieldIcon className="h-[15px] w-[15px]" strokeWidth={2.2} aria-hidden="true" />
              {hero.chips.gasSafe}
            </li>
          </ul>

          <h1 className="text-[46px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[72px]">
            {hero.headline.line1}
            <br />
            {hero.headline.line2} <span className="highlight">{hero.headline.highlight}</span>
          </h1>

          <p className="text-[17px] leading-normal text-text-2 lg:max-w-lg lg:text-lg">{hero.subline}</p>
        </div>

        <div className="mt-[18px] flex flex-col gap-[18px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
          <div className="mx-1 mt-2 -rotate-2 [--stub:122px] [filter:drop-shadow(0_14px_14px_rgba(181,65,28,0.32))] sm:[--stub:150px] lg:mx-0 lg:mt-0">
            <div className="ticket-notches relative flex rounded-[18px] bg-terracotta-deep text-white lg:rounded-3xl">
              <div className="flex flex-1 flex-col gap-0.5 py-[18px] pr-[18px] pl-5 sm:p-7">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ticket-ink">{t.label}</span>
                <span className="text-[54px] font-extrabold leading-none tracking-[-0.03em] sm:text-7xl">{t.price}</span>
                <span className="text-sm leading-[1.35] text-ticket-ink sm:mt-1 sm:text-base">{t.text}</span>
              </div>
              <div className="flex w-[var(--stub)] flex-none flex-col items-center justify-center gap-0.5 rounded-r-[18px] border-l-2 border-dashed border-white/60 bg-ticket-stub px-3 py-[18px] text-center lg:rounded-r-3xl">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ticket-ink">{t.stubLabel}</span>
                <span className="text-[54px] font-extrabold leading-none tracking-[-0.03em] text-sun sm:text-7xl">{t.stubPrice}</span>
                <span className="text-xs leading-[1.3] text-ticket-ink sm:mt-1 sm:text-sm">{t.stubText}</span>
              </div>
            </div>
          </div>
          <p className="mt-0.5 text-center text-sm text-text-2">{hero.underTicket}</p>
        </div>

        <div className="mt-[18px] flex flex-col gap-[18px] lg:col-start-1 lg:row-start-2 lg:mt-8 lg:self-start">
          <Link
            href={contactHref("repair")}
            className="flex h-[62px] items-center justify-center gap-2.5 rounded-full bg-terracotta-deep px-6 text-[19px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(181,65,28,0.7)] transition-colors hover:bg-ticket-stub"
          >
            {hero.cta}
            <ArrowRightIcon className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </Link>

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={business.phoneHref}
              className="flex h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-navy text-base font-semibold transition-colors hover:bg-navy hover:text-white"
            >
              <PhoneIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
              Call now
            </a>
            <a
              href={business.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-whatsapp-dark text-base font-semibold text-white transition-[filter] hover:brightness-110"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" aria-hidden="true" />
              WhatsApp
            </a>
          </div>

          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-semibold lg:justify-start">
            {hero.ticks.map((tick) => (
              <li key={tick} className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-whatsapp-dark" strokeWidth={3} aria-hidden="true" />
                {tick}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Five small orange stars for the rating chip. Decorative: the chip
// text gives the real score.
function Stars() {
  const star = "7,0 9,5 14,5.3 10.2,8.5 11.4,13.5 7,10.8 2.6,13.5 3.8,8.5 0,5.3 5,5";
  return (
    <svg width="76" height="14" viewBox="0 0 76 14" aria-hidden="true" className="text-terracotta">
      <g fill="currentColor">
        {[0, 15.5, 31, 46.5, 62].map((x) => (
          <polygon key={x} points={star} transform={`translate(${x} 0)`} />
        ))}
      </g>
    </svg>
  );
}
