import Link from "next/link";
import { business, closingCard } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { ArrowRightIcon } from "./icons";

// The navy card at the foot of the homepage: the ask once more, in yellow.
export function ClosingCard() {
  const [line1, line2] = closingCard.heading;
  return (
    <section className="bg-page pb-12 lg:pb-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-col gap-3.5 rounded-3xl bg-navy px-[22px] py-7 text-white lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-14 lg:py-14">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              {line1}
              <br />
              {line2}
            </h2>
            <p className="text-base leading-normal text-[#d5dae3] lg:max-w-md lg:text-lg">
              {closingCard.text}
            </p>
          </div>
          <div className="flex flex-col gap-3.5 lg:w-[360px] lg:flex-none">
            <Link
              href={contactHref("repair")}
              className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-sun text-lg font-bold text-navy transition-[filter] hover:brightness-95"
            >
              {closingCard.cta}
              <ArrowRightIcon
                className="h-5 w-5"
                strokeWidth={2.4}
                aria-hidden="true"
              />
            </Link>
            <a
              href={business.phoneHref}
              className="inline-flex min-h-11 items-center self-center text-[15px] font-semibold underline underline-offset-[3px]"
            >
              or call {business.phoneDisplay}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
