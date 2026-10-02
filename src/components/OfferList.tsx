import Link from "next/link";
import { offer } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { Heading, Eyebrow } from "./Heading";
import { CheckIcon } from "./icons";
import { Reveal } from "./Reveal";

// The one ticked list on the homepage: the repair offer, the thing people
// compare. Then the ask again.
export function OfferList() {
  return (
    <section className="bg-cream py-14 lg:py-28">
      <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[28px] border border-line bg-white p-7 shadow-[0_24px_50px_-32px_rgba(31,42,58,0.3)] sm:p-10 lg:grid lg:grid-cols-2 lg:gap-16 lg:p-14">
          <div>
            <Eyebrow>The repair</Eyebrow>
            <Heading lead={offer.heading.lead} em={offer.heading.em} emLine className="mt-3 text-3xl sm:text-4xl" />
            <Link
              href={contactHref("repair")}
              className="bg-btn-gradient mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
            >
              {offer.cta}
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-text-3 sm:text-sm">{offer.note}</p>
          </div>
          <ul className="mt-8 flex flex-col divide-y divide-line lg:mt-0">
            {offer.items.map((item) => (
              <li key={item} className="flex items-start gap-3 py-3.5 text-base leading-relaxed text-navy">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-white">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
