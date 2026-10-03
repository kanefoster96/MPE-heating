import Link from "next/link";
import { rating, reviews } from "@/lib/content";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./Reveal";
import { ReviewCarousel } from "./ReviewCarousel";
import { Stars } from "./Stars";

// "5-star rated on TrustATrader" on a tilted card (a nod to the hero's
// ticket); the stars pop in when it scrolls into view. `external` sends
// the button to the profile itself; otherwise it opens our reviews page.
export function RatingCard({ external = false }: { external?: boolean }) {
  const button =
    "mt-5 flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-navy text-base font-semibold transition-colors hover:bg-navy hover:text-white";
  return (
    <div className="mx-1.5 -rotate-[1.5deg] lg:mx-0">
      <div className="rounded-3xl border-[1.5px] border-edge bg-white p-6 shadow-[0_18px_40px_-22px_rgba(31,42,58,0.35)] sm:p-8">
        <Stars size="h-10 w-10 sm:h-12 sm:w-12" className="gap-1" />
        <p className="mt-4 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">5-star rated</p>
        <p className="text-base font-semibold text-text-2">on {rating.source}</p>
        {external ? (
          <a href={rating.url} target="_blank" rel="noopener noreferrer" className={button}>
            See them on {rating.source}
            <ArrowRightIcon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">(opens {rating.source})</span>
          </a>
        ) : (
          <Link href="/reviews" className={button}>
            Read the reviews
            <ArrowRightIcon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

// The rating, then every real review as swipeable cards.
export function Reviews() {
  return (
    <section className="overflow-x-clip bg-page py-12 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">What customers say</p>
            <h2 className="mt-2 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              Rated 5 stars
              <br />
              by our customers.
            </h2>
            <p className="mt-3 text-base leading-normal text-text-2 lg:text-lg">
              Our reviews are on {rating.source}, so you can check every one for yourself.
            </p>
          </Reveal>
          <RatingCard />
        </div>
      </div>
      {reviews.length > 0 && (
        <div className="mt-10 lg:mt-14">
          <ReviewCarousel reviews={reviews} source={rating.source} />
        </div>
      )}
    </section>
  );
}
