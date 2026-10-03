import type { ReactNode } from "react";
import type { TwoTone } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { IconTile } from "./IconTile";
import { Reveal } from "./Reveal";

// Small tiles: an icon, a bold line and a short line. Used on the service
// pages for what the page is promising.
export function FeatureGrid({
  eyebrow,
  heading,
  items,
}: {
  eyebrow: string;
  heading: TwoTone;
  items: { icon: ReactNode; title: string; text: string }[];
}) {
  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading lead={heading.lead} em={heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
        </Reveal>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div key={item.title} className="rounded-[24px] border border-line bg-white p-6">
              <IconTile icon={item.icon} primary={i === 0} />
              <h3 className="mt-5 text-lg font-bold leading-tight text-navy">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{item.text}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
