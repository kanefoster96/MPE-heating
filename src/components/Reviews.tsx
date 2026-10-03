import { rating, reviews } from "@/lib/content";
import { ArrowRightIcon, StarIcon } from "./icons";
import { Reveal } from "./Reveal";

function Stars({ className = "" }: { className?: string }) {
  return (
    <span className={`flex gap-0.5 text-terracotta ${className}`} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} className="h-5 w-5" />
      ))}
    </span>
  );
}

// The real TrustATrader rating on a tilted card (a nod to the hero's
// ticket), with a link to read every review there. Quotes show beneath
// only once real ones are added to `reviews` in content.ts.
export function Reviews() {
  return (
    <section className="bg-page py-12 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">What customers say</p>
            <h2 className="mt-2 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              Rated {rating.score} out of 5
              <br />
              by our customers.
            </h2>
            <p className="mt-3 text-base leading-normal text-text-2 lg:text-lg">
              From {rating.count} reviews on {rating.source}. Read every one of them there.
            </p>
          </Reveal>

          <div className="mx-1.5 -rotate-[1.5deg] lg:mx-0">
            <div className="rounded-3xl border-[1.5px] border-edge bg-white p-6 shadow-[0_18px_40px_-22px_rgba(31,42,58,0.35)] sm:p-8">
              <div className="flex items-center gap-4">
                <span className="text-[64px] font-extrabold leading-none tracking-[-0.04em] sm:text-7xl">{rating.score}</span>
                <span className="flex flex-col gap-1.5">
                  <Stars />
                  <span className="text-sm font-semibold text-text-2">out of 5</span>
                </span>
              </div>
              <p className="mt-4 border-t border-line pt-4 text-base font-semibold">
                {rating.count} reviews on {rating.source}
              </p>
              <a
                href={rating.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-navy text-base font-semibold transition-colors hover:bg-navy hover:text-white"
              >
                Read the reviews
                <ArrowRightIcon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                <span className="sr-only">(opens {rating.source})</span>
              </a>
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
            {reviews.map((r) => (
              <li key={r.name + r.date} className="rounded-[18px] bg-cream p-5 sm:p-6">
                <Stars />
                <p className="mt-3 text-base leading-relaxed">&ldquo;{r.quote}&rdquo;</p>
                <p className="mt-3 text-sm text-text-2">
                  <span className="font-semibold text-navy">{r.name}</span> · {r.date} · {rating.source}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
