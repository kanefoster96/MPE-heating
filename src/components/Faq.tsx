"use client";

import { useState } from "react";
import { faqs, business } from "@/lib/content";
import { ChevronDownIcon } from "./icons";

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
    <section id="faq" className="bg-cream py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            Questions
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mb-8 flex justify-center gap-8 border-b border-line">
          {(["homes", "commercial"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectTab(t)}
              className={`relative pb-3 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-navy" : "text-navy/45 hover:text-navy/70"
              }`}
            >
              {t === "homes" ? "Homes" : "Commercial"}
              {tab === t && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-terracotta" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="overflow-hidden rounded-2xl bg-white">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-navy sm:text-base">{item.q}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-terracotta transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-navy/70">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href={business.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border-2 border-navy px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            Ask us a question
          </a>
        </div>
      </div>
    </section>
  );
}
