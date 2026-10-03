import Link from "next/link";
import { promises } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

// Four promise badges: a big short value and one line under it, then the
// ask. Scannable at a glance, no list to read.
export function Promises() {
  return (
    <section className="bg-page py-14 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>Guarantees</Eyebrow>
          <Heading lead={promises.heading.lead} em={promises.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
        </Reveal>

        <Reveal as="ul" className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {promises.items.map((item) => (
            <li key={item.value} className="rounded-[24px] border border-line bg-cream p-5 sm:p-6">
              <p className="text-2xl font-extrabold leading-none tracking-tight text-navy sm:text-4xl">{item.value}</p>
              <p className="mt-3 text-sm leading-snug text-text-2">{item.label}</p>
            </li>
          ))}
        </Reveal>

        <Reveal className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href="/emergency"
            className="bg-btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
          >
            {promises.cta}
          </Link>
          <p className="text-sm text-text-2">{promises.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
