import type { ReactNode } from "react";

// Reuses the same icon-card visual language as the homepage's WhyMpe
// section, generalised for the service sub-pages.
export function FeatureGrid({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: { icon: ReactNode; title: string; text: string }[];
}) {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            {title}
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-[24px] bg-grey p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-terracotta shadow-[0_10px_25px_-12px_rgba(31,42,58,0.3)]">
                {item.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold text-navy">{item.title}</h3>
              <p className="mt-2 text-sm text-navy/70">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
