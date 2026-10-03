"use client";

import { useRef } from "react";
import { reviews } from "@/lib/content";
import { StarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

export function Reviews() {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-review-card]");
    rail.scrollBy({ left: dir * ((card?.offsetWidth ?? 300) + 16), behavior: "smooth" });
  };

  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Reviews</Eyebrow>
            <Heading lead="What customers say." em="Same day, fair price." className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
          </div>
          <div className="hidden gap-3 sm:flex">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => scrollBy(-1)}
              className="grid h-11 w-11 place-items-center rounded-full border border-navy/15 text-navy transition-colors hover:bg-navy hover:text-white"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next review"
              onClick={() => scrollBy(1)}
              className="grid h-11 w-11 place-items-center rounded-full border border-navy/15 text-navy transition-colors hover:bg-navy hover:text-white"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </Reveal>

        <div
          ref={railRef}
          className="no-scrollbar -mx-4 mt-8 flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0"
        >
          {reviews.map((r) => (
            <blockquote
              key={r.name}
              data-review-card
              className="w-[85%] shrink-0 snap-start rounded-[24px] border border-line bg-white p-6 sm:w-[340px]"
            >
              <div className="flex gap-0.5 text-navy" aria-label="Five stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="h-4 w-4" />
                ))}
              </div>
              <p className="mt-4 text-base leading-relaxed text-navy">&ldquo;{r.quote}&rdquo;</p>
              <footer className="mt-5 flex items-center justify-between text-xs">
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="text-text-3">{r.date}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
