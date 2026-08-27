"use client";

import { useRef } from "react";
import { reviews, reviewSummary, business } from "@/lib/content";
import { StarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

export function Reviews() {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-review-card]");
    const amount = (card?.offsetWidth ?? 300) + 16;
    rail.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
              Reviews
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              What customers say
            </h2>
          </div>
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => scrollBy(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy transition-colors hover:bg-grey"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next review"
              onClick={() => scrollBy(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy transition-colors hover:bg-grey"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          className="no-scrollbar mt-8 flex gap-4 overflow-x-auto scroll-smooth pb-2"
        >
          {reviews.map((r) => (
            <div
              key={r.name}
              data-review-card
              className="w-[85%] shrink-0 snap-start rounded-[24px] bg-grey p-6 sm:w-[340px]"
            >
              <div className="flex gap-0.5 text-terracotta">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-navy/85">&ldquo;{r.quote}&rdquo;</p>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="text-navy/50">{r.date}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-navy/70">
            Rated <span className="font-bold text-navy">{reviewSummary.rating}/5</span> from{" "}
            {reviewSummary.count}+ reviews on TrustATrader
          </p>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(business.fullName + " reviews")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border-2 border-navy px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            Leave a review on Google
          </a>
        </div>
      </div>
    </section>
  );
}
