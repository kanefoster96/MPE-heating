import Link from "next/link";
import { hero } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";

// Thin strip under the nav: one line and a small pill. Static, no cycling.
export function PromoBar() {
  return (
    <div className="border-b border-line bg-cream">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-center gap-4 px-4 py-2 sm:px-6">
        <p className="text-sm font-medium text-navy">{hero.banner.text}</p>
        <Link
          href={contactHref("repair")}
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
        >
          {hero.banner.cta}
        </Link>
      </div>
    </div>
  );
}
