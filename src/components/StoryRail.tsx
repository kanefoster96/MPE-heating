"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

// A horizontal row of story cards that scrolls sideways, with round
// previous and next buttons. A card's chips start only when that card is
// fully in view inside the rail and the rail is on screen; cards that
// arrive together go in turn, about 0.75s apart.
export function StoryRail({ children, label }: { children: ReactNode; label: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const wrap = wrapRef.current;
    if (!rail || !wrap) return;

    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-story-card]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      cards.forEach((c) => c.classList.add("chips-in"));
      return;
    }

    // Everything starts hidden only once we know we can animate, so a
    // visitor without JS still sees the chips.
    wrap.classList.add("anim");

    let railVisible = false;
    const inRail = new Set<HTMLElement>();
    const queue: HTMLElement[] = [];
    let draining = false;

    const drain = () => {
      if (draining) return;
      draining = true;
      const step = () => {
        const next = queue.shift();
        if (!next) {
          draining = false;
          return;
        }
        next.classList.add("chips-in");
        setTimeout(step, 750);
      };
      step();
    };

    const consider = (card: HTMLElement) => {
      if (!railVisible || !inRail.has(card)) return;
      if (card.classList.contains("chips-in") || queue.includes(card)) return;
      queue.push(card);
      drain();
    };

    const railObserver = new IntersectionObserver(
      (entries) => {
        railVisible = entries.some((e) => e.isIntersecting);
        if (railVisible) cards.forEach(consider);
      },
      { threshold: 0.2 }
    );
    railObserver.observe(rail);

    const cardObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            inRail.add(card);
            consider(card);
          } else {
            inRail.delete(card);
          }
        }
      },
      { root: rail, threshold: 0.85 }
    );
    cards.forEach((c) => cardObserver.observe(c));

    return () => {
      railObserver.disconnect();
      cardObserver.disconnect();
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-story-card]");
    rail.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 22), behavior: "smooth" });
  };

  return (
    <div ref={wrapRef}>
      <div ref={railRef} className="rail" role="region" aria-label={label}>
        {children}
      </div>
      <div className="mx-auto flex max-w-6xl justify-center gap-3 px-4 sm:justify-end sm:px-6">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => scrollBy(-1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-navy/15 text-navy transition-colors hover:bg-navy hover:text-white"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => scrollBy(1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-navy/15 text-navy transition-colors hover:bg-navy hover:text-white"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// A tall card, 28px corners, slightly tilted (straightening on hover), with
// an icon tile, a short title, one line of copy and three chips.
export function StoryCard({
  tile,
  title,
  text,
  chips,
}: {
  tile: ReactNode;
  title: string;
  text: string;
  chips: ReactNode;
}) {
  return (
    <article
      data-story-card
      className="story-card flex flex-col rounded-[28px] border border-line bg-white p-7 shadow-[0_24px_50px_-30px_rgba(31,42,58,0.35)]"
    >
      {tile}
      <h3 className="mt-6 text-[23px] font-extrabold leading-tight tracking-tight text-navy">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-text-2">{text}</p>
      <div className="mt-7 flex flex-col items-start gap-2.5">{chips}</div>
    </article>
  );
}
