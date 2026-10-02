"use client";

import { useState } from "react";
import { faqs, business } from "@/lib/content";
import { ChevronDownIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

type Tab = "homes" | "commercial";

export function Faq() {
  const [tab, setTab] = useState<Tab>("homes");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = faqs[tab];

  const selectTab = (t: Tab) => {
    setTab(t);
    setOpenIndex(0);
  };

  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <Heading lead="Questions." em="Straight answers." className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
        </Reveal>

        <div className="mt-8 flex gap-2" role="tablist" aria-label="Who the questions are for">
          {(["homes", "commercial"] as Tab[]).map((t) => {
            const selected = tab === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(t)}
                className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors ${
                  selected ? "bg-navy text-white" : "bg-white text-navy hover:bg-grey"
                }`}
              >
                {t === "homes" ? "Homes" : "Commercial"}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="overflow-hidden rounded-2xl border border-line bg-white">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-base font-semibold text-navy">{item.q}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-navy transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && <p className="px-5 pb-5 text-base leading-relaxed text-text-2">{item.a}</p>}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-text-2">
          Something else?{" "}
          <a
            href={business.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-navy underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
          >
            Ask us on WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
