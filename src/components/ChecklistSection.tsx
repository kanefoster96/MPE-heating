import type { TwoTone } from "@/lib/content";
import { CheckIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

// The one ticked list on a service page (common faults, what's included,
// and so on), with an optional single sentence underneath.
export function ChecklistSection({
  eyebrow,
  heading,
  items,
  note,
}: {
  eyebrow: string;
  heading: TwoTone;
  items: string[];
  note?: string;
}) {
  return (
    <section className="bg-page py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-16">
        <Reveal className="lg:col-span-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading lead={heading.lead} em={heading.em} className="mt-3 text-3xl sm:text-4xl" />
          {note && <p className="mt-5 text-base leading-relaxed text-text-2">{note}</p>}
        </Reveal>

        <Reveal as="ul" className="mt-8 flex flex-col divide-y divide-line lg:col-span-3 lg:mt-0">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 py-3.5 text-base leading-relaxed text-navy">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-white">
                <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {item}
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
