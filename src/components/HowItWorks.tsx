import { howItWorks, business } from "@/lib/content";
import { FormIcon, DoorstepIcon, WrenchFixIcon } from "./icons";
import { ProductArt } from "./ProductArt";

const iconMap = {
  form: FormIcon,
  doorstep: DoorstepIcon,
  wrench: WrenchFixIcon,
};

export function HowItWorks() {
  return (
    <section className="bg-cream py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            The process
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            How it works
          </h2>
        </div>

        <div className="grid gap-10 sm:grid-cols-3 sm:gap-6">
          {howItWorks.map((step) => {
            const Icon = iconMap[step.icon];
            return (
              <div key={step.number} className="flex flex-col items-center text-center">
                <ProductArt icon={<Icon className="h-full w-full" />} tone="white" size="sm" />
                <div className="mt-6 flex h-9 w-9 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mt-4 text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-navy/70">{step.text}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href={business.phoneHref}
            className="inline-flex items-center justify-center rounded-full bg-terracotta px-8 py-4 text-base font-semibold text-white shadow-[0_12px_25px_-10px_rgba(232,98,58,0.7)] transition-colors hover:bg-terracotta-dark"
          >
            Book a visit
          </a>
        </div>
      </div>
    </section>
  );
}
