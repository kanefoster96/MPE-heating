import { howItWorks } from "@/lib/content";
import { CheckIcon, FlameIcon } from "./icons";
import { Reveal } from "./Reveal";

// Three steps on one white card, tilted a touch, with two chips stuck over
// its corners. The chips float in once when scrolled into view, then stay
// still (and simply show for reduced-motion visitors).
export function HowItWorks() {
  const [line1, line2] = howItWorks.heading;
  return (
    <section className="bg-cream pt-10 pb-[52px] lg:py-24">
      <div className="mx-auto grid max-w-6xl px-5 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-x-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">How it works</p>
          <h2 className="mt-2 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            {line1}
            <br />
            {line2}
          </h2>
        </div>

        <div className="relative mx-1.5 mt-[30px] rotate-[1.2deg] lg:mx-0 lg:mt-0">
          <ol className="flex flex-col gap-5 rounded-[22px] bg-white px-5 pt-[22px] pb-6 shadow-[0_18px_40px_-22px_rgba(31,42,58,0.35)] sm:p-8">
            {howItWorks.steps.map((step, i) => {
              const last = i === howItWorks.steps.length - 1;
              return (
                <li key={step.title} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-[17px] font-extrabold ${
                      last ? "bg-navy text-sun" : "bg-terracotta-deep text-white"
                    }`}
                  >
                    {last ? <FlameIcon className="h-[18px] w-[18px]" strokeWidth={2.2} /> : i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="text-[15px] leading-[1.45] text-text-2">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <span className="absolute -top-4 -right-1 rotate-[5deg]">
            <Reveal
              as="span"
              base="pop-in"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-[9px] text-[13px] font-bold shadow-[0_10px_24px_-10px_rgba(31,42,58,0.4)]"
            >
              <CheckIcon className="h-[15px] w-[15px] text-whatsapp-dark" strokeWidth={3} aria-hidden="true" />
              {howItWorks.chips.agreed}
            </Reveal>
          </span>
          <span className="absolute -bottom-[18px] -left-1.5 -rotate-[4deg]">
            <Reveal
              as="span"
              base="pop-in"
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-[9px] text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(31,42,58,0.5)] [transition-delay:150ms]"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sun" />
              {howItWorks.chips.refunded}
            </Reveal>
          </span>
        </div>
      </div>
    </section>
  );
}
