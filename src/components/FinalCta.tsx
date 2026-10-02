import { business, finalCta, type TwoTone } from "@/lib/content";
import type { EnquiryType } from "@/lib/enquiry";
import { Heading } from "./Heading";
import { RoundField } from "./RoundField";
import { Reveal } from "./Reveal";

// The main ask again, at the foot of every page. Heading and CTA default
// to the homepage's, but can be overridden where "Boiler playing up?"
// doesn't fit (the commercial page).
export function FinalCta({
  heading = finalCta.heading,
  cta = finalCta.cta,
  type = "repair",
}: {
  heading?: TwoTone;
  cta?: string;
  type?: EnquiryType;
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
        <RoundField cta={cta} type={type} className="mt-8" />
        <p className="mt-5 text-sm text-text-2">
          Or call{" "}
          <a href={business.phoneHref} className="font-semibold text-navy">
            {business.phoneDisplay}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
