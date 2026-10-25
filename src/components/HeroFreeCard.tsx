"use client";

import { useState } from "react";
import { fee, freeOffers } from "@/lib/content";
import { FreeOfferLink, offerIcons } from "./FreeOfferLink";
import { ChevronRightIcon } from "./icons";

// The orange card on the right of the hero, in the kanvas.one style: three
// free ways to start, each a row you can tap, split by thin lines. The
// call-out row has an "i" that explains how the £50 comes off the bill.
export function HeroFreeCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full">
      <div className="rounded-[22px] bg-[linear-gradient(135deg,var(--color-terracotta-deep)_0%,#a83c19_100%)] px-5 pt-5 pb-1 text-left text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ffe1d0]">{freeOffers.heading}</p>
        <ul className="mt-2">
          {freeOffers.items.map((item, i) => {
            const Icon = offerIcons[item.key];
            return (
              <li key={item.key} className={`flex items-center gap-2 ${i ? "border-t border-white/25" : ""}`}>
                <FreeOfferLink item={item} className="group flex min-h-[64px] flex-1 items-center gap-3 py-3">
                  <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/15">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-bold leading-snug">{item.title}</span>
                    <span className="block text-sm leading-snug text-[#ffe1d0]">{item.note}</span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 flex-none transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </FreeOfferLink>
                {item.key === "callout" && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-controls="note-fee"
                    aria-label="How the £50 call-out works"
                    className={`relative grid h-[22px] w-[22px] flex-none place-items-center rounded-full font-serif text-xs font-bold italic transition-colors before:absolute before:-inset-[11px] before:content-[''] ${
                      open ? "bg-white text-terracotta-deep" : "bg-white/25 text-white hover:bg-white hover:text-terracotta-deep"
                    }`}
                  >
                    i
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p
        id="note-fee"
        hidden={!open}
        className="mt-3.5 rounded-[22px] border-[1.5px] border-terracotta-deep/45 bg-white px-5 py-4 text-left text-[14.5px] leading-[1.45] text-text-2"
      >
        <b className="mb-1 block text-[17px] font-bold tracking-[-0.01em] text-terracotta-deep">{fee.title}</b>
        {fee.lines.join(" ")}
      </p>
    </div>
  );
}
