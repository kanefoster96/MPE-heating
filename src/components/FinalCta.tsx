import Link from "next/link";
import { business, finalCta, type TwoTone } from "@/lib/content";
import type { EnquiryType } from "@/lib/enquiry";
import { Heading } from "./Heading";
import { RoundField } from "./RoundField";
import { Reveal } from "./Reveal";
import { FeeNote } from "./FeeNote";

// The main ask again, at the foot of every page. Heading and CTA default
// to the homepage's, but can be overridden where "Boiler playing up?"
// doesn't fit (the commercial page).
export function FinalCta({
  heading = finalCta.heading,
  cta = finalCta.cta,
  shortCta,
  type = "repair",
  secondary,
}: {
  heading?: TwoTone;
  cta?: string;
  shortCta?: string;
  type?: EnquiryType;
  // A second, quieter action under the field, e.g. "Book something else".
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="bg-page py-14 lg:py-28">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <Heading
          lead={heading.lead}
          em={heading.em}
          emLine
          className="text-3xl sm:text-4xl lg:text-5xl"
        />
        <RoundField cta={cta} shortCta={shortCta} type={type} className="mt-8" />
        {type === "repair" && <FeeNote compact className="mt-5" />}
        {secondary && (
          <Link
            href={secondary.href}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-navy/20 px-7 text-base font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            {secondary.label}
          </Link>
        )}
        <p className="mt-4 text-sm text-text-2">
          Or call{" "}
          <a href={business.phoneHref} className="font-semibold text-navy">
            {business.phoneDisplay}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
