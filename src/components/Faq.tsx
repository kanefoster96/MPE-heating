"use client";

import { useState } from "react";
import Link from "next/link";
import { faqs, business } from "@/lib/content";
import { ChevronDownIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

type Tab = "homes" | "commercial";

// Two columns: heading and actions on the left, a ruled accordion on the
// right (rows split by lines, not boxes). `limit` shows only the first few
// home questions with no tabs, for the homepage; the FAQs page shows all.
export function Faq({ limit }: { limit?: number } = {}) {
  const [tab, setTab] = useState<Tab>("homes");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = limit ? faqs.homes.slice(0, limit) : faqs[tab];

  const selectTab = (t: Tab) => {
    setTab(t);
    setOpenIndex(0);
  };

  return (
    <section className="bg-cream py-14 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-5 lg:gap-16">
        <Reveal className="lg:col-span-2">
          <Eyebrow>Questions</Eyebrow>
          <Heading lead="Questions." em="Straight answers." className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />

          {!limit && (
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
                      selected ? "bg-navy text-white" : "bg-white text-navy hover:bg-navy/10"
                    }`}
                  >
                    {t === "homes" ? "Homes" : "Commercial"}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-8 hidden flex-col items-start gap-3 lg:flex">
            {limit && (
              <Link
                href="/faqs"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-navy-light"
              >
                See all questions
              </Link>
            )}
            <Link href="/contact" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline decoration-navy/30 underline-offset-4 hover:decoration-navy">
              Ask us something else
            </Link>
          </div>
        </Reveal>

        <Reveal className="lg:col-span-3">
          <ul className="divide-y divide-navy/15 border-y border-navy/15">
            {items.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex min-h-14 w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-lg font-bold leading-snug text-navy">{item.q}</span>
                    <ChevronDownIcon
                      className={`h-5 w-5 shrink-0 text-navy transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && <p className="pb-6 pr-8 text-base leading-relaxed text-text-2">{item.a}</p>}
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:hidden">
            {limit && (
              <Link
                href="/faqs"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-navy px-6 text-base font-semibold text-white"
              >
                See all questions
              </Link>
            )}
            <Link
              href="/contact"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-navy/20 px-6 text-base font-semibold text-navy"
            >
              Ask us something else
            </Link>
          </div>

          {!limit && (
            <p className="mt-8 text-sm text-text-2">
              Prefer a quick chat?{" "}
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
          )}
        </Reveal>
      </div>
    </section>
  );
}
