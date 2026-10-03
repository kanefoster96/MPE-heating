"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

// Fades its children up 22px once, the first time they scroll into view,
// then leaves them alone. Reduced-motion visitors see them straight away
// (globals.css handles that).
export function Reveal({
  as: Tag = "div",
  base = "reveal",
  className = "",
  children,
}: {
  as?: ElementType;
  // The CSS class that holds the hidden state: "reveal" fades up,
  // "pop-in" floats a small chip in.
  base?: "reveal" | "pop-in";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-in");
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`${base} ${className}`}>
      {children}
    </Tag>
  );
}
