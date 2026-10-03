import Link from "next/link";
import { hero } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";

// Navy strip under the nav: one line and a yellow pill. Static, no cycling.
export function PromoBar() {
  return (
    <div className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:justify-center sm:gap-5 sm:px-6">
        <p className="text-[15px] font-medium">{hero.banner.text}</p>
        <Link
          href={contactHref("repair")}
          className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-sun px-[18px] text-[15px] font-bold text-navy transition-[filter] hover:brightness-95"
        >
          {hero.banner.cta}
        </Link>
      </div>
    </div>
  );
}
