import Link from "next/link";
import { business, hero, accreditations } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { GasSafeMarkIcon, ShieldIcon, AwardIcon, StarIcon } from "./icons";
import { Heading } from "./Heading";
import { StatusLine } from "./StatusLine";

const markIcons = [GasSafeMarkIcon, ShieldIcon, AwardIcon];

// Hero, in the Academy's order: proof row (overlapping marks, who we
// serve, stars), status line, two-tone headline, one paragraph, one big
// pill button, two quiet lines under it, and a text link for people who'd
// rather call. No visual.
export function Hero() {
  return (
    <section className="bg-page pt-12 pb-14 sm:pt-16 lg:pt-20 lg:pb-24">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <ul className="flex -space-x-2.5" aria-label="Accreditations">
          {accreditations.map((label, i) => {
            const Icon = markIcons[i];
            return (
              <li
                key={label}
                title={label}
                className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-navy text-white"
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-navy">
          {hero.proof.lead}
          <span className="block font-semibold text-text-3">{hero.proof.sub}</span>
        </p>
        <p className="mt-3 flex items-center gap-1 text-navy" aria-label={`Five stars. ${hero.proof.rated}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon key={i} className="h-5 w-5" />
          ))}
        </p>

        <StatusLine className="mt-10">{hero.status}</StatusLine>

        <Heading
          as="h1"
          lead={hero.headline.lead}
          em={hero.headline.em}
          emLine
          className="mt-5 text-[40px] sm:text-6xl lg:text-[64px]"
        />

        <p className="mt-6 max-w-xl text-base leading-relaxed text-text-2 sm:text-lg">{hero.subline}</p>

        <Link
          href={contactHref("repair")}
          className="bg-btn-gradient mt-8 inline-flex min-h-14 w-full max-w-xl items-center justify-center rounded-full px-8 text-lg font-semibold text-white shadow-[0_18px_40px_-20px_rgba(207,80,41,0.6)]"
        >
          {hero.cta}
        </Link>

        <p className="mt-4 text-sm font-semibold text-navy">{hero.underButton[0]}</p>
        <p className="mt-1 text-sm text-text-2">{hero.underButton[1]}</p>

        <p className="mt-5 text-sm text-text-2">
          {hero.secondary}{" "}
          <a
            href={business.phoneHref}
            className="font-semibold text-navy underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
          >
            Call {business.phoneDisplay}
          </a>
        </p>
      </div>
    </section>
  );
}
