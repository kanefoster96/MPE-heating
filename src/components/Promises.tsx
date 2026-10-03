import Link from "next/link";
import { promises } from "@/lib/content";
import { Reveal } from "./Reveal";

// A full-width navy band: big white values in a row, split by thin rules,
// then the ask. No boxes.
export function Promises() {
  return (
    <section className="bg-navy py-14 text-white lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Guarantees</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
            {promises.heading.lead}
            <span className="block text-white/60">{promises.heading.em}</span>
          </h2>
        </Reveal>

        <Reveal as="ul" className="mt-10 grid grid-cols-2 border-t border-white/15 lg:mt-14 lg:grid-cols-4">
          {promises.items.map((item, i) => (
            <li
              key={item.value}
              className={`border-white/15 py-6 pr-4 lg:py-8 lg:pl-8 lg:pr-6 ${i % 2 === 1 ? "border-l pl-4" : ""} ${
                i >= 2 ? "border-t lg:border-t-0" : ""
              } ${i === 2 ? "lg:border-l" : ""} ${i === 0 ? "lg:pl-0" : ""}`}
            >
              <p className="text-3xl font-extrabold leading-none tracking-tight sm:text-5xl">{item.value}</p>
              <p className="mt-3 text-sm leading-snug text-white/70">{item.label}</p>
            </li>
          ))}
        </Reveal>

        <Reveal className="mt-8 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/emergency"
            className="bg-btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
          >
            {promises.cta}
          </Link>
          <p className="text-sm text-white/60">{promises.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
