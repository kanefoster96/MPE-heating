"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { promoMessages } from "@/lib/content";

const CYCLE_MS = 5000;
const FADE_MS = 400;

export function PromoStrip() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (promoMessages.length < 2) return;

    const interval = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIndex((i) => (i + 1) % promoMessages.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(swap);
    }, CYCLE_MS);

    return () => clearInterval(interval);
  }, []);

  const current = promoMessages[index];
  const isCold = current.tone === "cold";

  return (
    <div className={`transition-colors duration-700 ${isCold ? "bg-blue" : "bg-yellow"}`}>
      <Link
        href="/book"
        aria-label="Book a visit"
        className="mx-auto flex max-w-6xl items-center justify-center px-4 py-2.5 sm:px-6"
      >
        <p
          style={{ transitionDuration: `${FADE_MS}ms` }}
          className={`min-w-0 max-w-full truncate text-center text-xs font-medium transition-opacity sm:text-sm ${
            isCold ? "text-white" : "text-navy"
          } ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {current.text}
        </p>
      </Link>
    </div>
  );
}
