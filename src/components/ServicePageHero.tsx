import type { ReactNode } from "react";
import type { TwoTone } from "@/lib/content";
import type { EnquiryType } from "@/lib/enquiry";
import { Heading, Eyebrow } from "./Heading";
import { StatusLine } from "./StatusLine";
import { RoundField } from "./RoundField";
import { IconTile } from "./IconTile";
import { FeeNote } from "./FeeNote";

// Hero for every page that isn't the homepage: an icon tile, a status
// line, the two-tone headline, one line of copy, the round field, and one
// sentence of reassurance. No ticks here: each page keeps one list, and
// it lives further down.
export function ServicePageHero({
  icon,
  eyebrow,
  headline,
  status,
  subline,
  cta,
  type,
  reassurance,
  shortCta,
  showFee = false,
}: {
  icon: ReactNode;
  eyebrow: string;
  headline: TwoTone;
  status?: string;
  subline: string;
  cta: string;
  type: EnquiryType;
  reassurance?: string;
  shortCta?: string;
  // Repair-type pages show the £50 call-out explainer under the ask.
  showFee?: boolean;
}) {
  return (
    <section className="bg-page pt-12 pb-14 sm:pt-16 lg:pt-24 lg:pb-24">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        <IconTile icon={icon} primary className="-rotate-3" />
        <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
        {status && <StatusLine className="mt-3">{status}</StatusLine>}
        <Heading
          as="h1"
          lead={headline.lead}
          em={headline.em}
          emLine
          className="mt-4 max-w-3xl text-[36px] sm:text-5xl lg:text-6xl"
        />
        <p className="mt-5 max-w-xl text-base leading-relaxed text-text-2 sm:text-lg">{subline}</p>
        <RoundField cta={cta} shortCta={shortCta} type={type} className="mt-8" />
        {showFee && <FeeNote className="mt-5 w-full max-w-xl" />}
        {reassurance && !showFee && (
          <p className="mt-4 max-w-md text-xs leading-relaxed text-text-3 sm:text-sm">{reassurance}</p>
        )}
      </div>
    </section>
  );
}
