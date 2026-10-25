"use client";

import { useState } from "react";
import { fee, guarantee, hero } from "@/lib/content";
import { CheckIcon } from "./icons";

// The orange card of promises on the right of the hero, as on kanvas.one:
// white ticks, rows split by thin lines, and an "i" that opens a note
// under the card (how the £50 call-out works, what the guarantee covers).
const notes = {
  fee: { label: "How the £50 call-out works", title: fee.title, text: fee.lines.join(" ") },
  guarantee: { label: "What the guarantee covers", title: guarantee.title, text: guarantee.text },
} as const;
type NoteKey = keyof typeof notes;

export function HeroPromises() {
  const [open, setOpen] = useState<NoteKey | null>(null);
  return (
    <div className="w-full">
      <ul className="rounded-[22px] bg-[linear-gradient(135deg,var(--color-terracotta-deep)_0%,#c24e1c_100%)] px-5 py-1 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,0.18)]">
        {hero.promises.map((p, i) => (
          <li
            key={p.text}
            className={`flex min-h-[52px] items-center gap-2.5 py-3 text-[15.5px] font-semibold text-white ${i ? "border-t border-white/25" : ""}`}
          >
            <CheckIcon className="h-[18px] w-[18px] flex-none" strokeWidth={2.6} aria-hidden="true" />
            <span className="flex-1">{p.text}</span>
            {p.info && (
              <button
                type="button"
                onClick={() => setOpen((o) => (o === p.info ? null : (p.info as NoteKey)))}
                aria-expanded={open === p.info}
                aria-controls={`note-${p.info}`}
                aria-label={notes[p.info as NoteKey].label}
                className={`relative grid h-[22px] w-[22px] flex-none place-items-center rounded-full font-serif text-xs font-bold italic transition-colors before:absolute before:-inset-[11px] before:content-[''] ${
                  open === p.info ? "bg-white text-terracotta-deep" : "bg-white/25 text-white hover:bg-white hover:text-terracotta-deep"
                }`}
              >
                i
              </button>
            )}
          </li>
        ))}
      </ul>
      {(Object.keys(notes) as NoteKey[]).map((key) => (
        <p
          key={key}
          id={`note-${key}`}
          hidden={open !== key}
          className="mt-3.5 rounded-[22px] border-[1.5px] border-terracotta-deep/45 bg-white px-5 py-4 text-left text-[14.5px] leading-[1.45] text-text-2"
        >
          <b className="mb-1 block text-[17px] font-bold tracking-[-0.01em] text-terracotta-deep">{notes[key].title}</b>
          {notes[key].text}
        </p>
      ))}
    </div>
  );
}
