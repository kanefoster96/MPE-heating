"use client";

import { useEffect, useRef } from "react";
import type { Review } from "@/lib/content";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Stars } from "./Stars";

// Review cards in a row you swipe through. Each card snaps to the centre
// of the screen, its neighbours peek in at the sides, and its stars pop in
// as it arrives. Arrow buttons do the same for mouse and keyboard users.
export function ReviewCarousel({
  reviews,
  source,
  tone = "cream",
}: {
  reviews: Review[];
  source: string;
  tone?: "cream" | "white";
}) {
  const track = useRef<HTMLUListElement>(null);

  // On wide screens, open on the second card so there are cards either
  // side of the centre rather than an empty half.
  useEffect(() => {
    const el = track.current;
    if (!el || reviews.length < 3 || !window.matchMedia("(min-width: 1024px)").matches) return;
    const second = el.children[1] as HTMLElement | undefined;
    if (second) el.scrollLeft = second.offsetLeft + second.offsetWidth / 2 - el.clientWidth / 2;
  }, [reviews.length]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const width = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * width, behavior: smooth ? "smooth" : "auto" });
  };

  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-navy/20 text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white";

  return (
    <div>
      {/* Side padding lets the first and last cards sit in the centre too. */}
      <ul
        ref={track}
        tabIndex={0}
        aria-label="Customer reviews"
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-[calc((100%_-_min(82vw,24rem))/2)] py-2 outline-none focus-visible:ring-2 focus-visible:ring-navy/30 lg:[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        {reviews.map((r) => (
          <li key={r.name + r.date} className="w-[min(82vw,24rem)] flex-none snap-center">
            <figure className={`flex h-full flex-col rounded-[22px] p-6 ${tone === "cream" ? "bg-cream" : "bg-white shadow-[0_18px_40px_-26px_rgba(31,42,58,0.35)]"}`}>
              <Stars />
              <blockquote className="mt-4 flex-1 text-[17px] leading-relaxed">&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm text-text-2">
                <span className="font-semibold text-navy">{r.name}</span> · {r.date} · {source}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" onClick={() => step(-1)} aria-label="Previous review" className={arrow}>
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Next review" className={arrow}>
          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
