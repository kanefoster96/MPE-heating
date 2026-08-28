"use client";

import { useEffect, useRef, useState } from "react";
import { hero } from "@/lib/content";
import { InfoIcon } from "./icons";

// Same-day fix rate + info icon shown near the hero's risk-reversal ticks.
// Click the icon to reveal why not every boiler can be fixed on the spot.
export function SameDayStat() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-1.5">
      <p className="text-sm font-semibold text-navy">
        <span className="text-terracotta">{hero.sameDayStat.value}</span> {hero.sameDayStat.label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Why isn't every boiler fixed same-day?"
        className="text-navy/40 transition-colors hover:text-navy/70"
      >
        <InfoIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 z-10 mt-2 w-64 -translate-x-1/2 rounded-2xl bg-white p-4 text-left text-xs leading-relaxed text-navy/70 shadow-[0_20px_45px_-20px_rgba(31,42,58,0.4)] sm:w-72">
          {hero.sameDayStat.explainer}
        </div>
      )}
    </div>
  );
}
