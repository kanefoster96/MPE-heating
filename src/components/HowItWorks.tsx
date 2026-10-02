import { howItWorks } from "@/lib/content";
import { chipIconMap } from "@/lib/chipIcons";
import { FormIcon, DoorstepIcon, WrenchFixIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Chip, IconTile } from "./Chip";
import { Reveal } from "./Reveal";

const iconMap = {
  form: FormIcon,
  doorstep: DoorstepIcon,
  wrench: WrenchFixIcon,
};

// How it works, 1, 2, 3: text on one side, a small tilted illustration
// card on the other, alternating.
export function HowItWorks() {
  return (
    <section className="bg-page py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>The process</Eyebrow>
          <Heading
            lead={howItWorks.heading.lead}
            em={howItWorks.heading.em}
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl"
          />
        </Reveal>

        <ol className="mt-12 flex flex-col gap-14 lg:mt-16 lg:gap-20">
          {howItWorks.steps.map((step, i) => {
            const Icon = iconMap[step.icon];
            const ChipIcon = chipIconMap[step.chip.icon];
            const flip = i % 2 === 1;
            return (
              <Reveal
                as="li"
                key={step.number}
                className={`flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-16 ${
                  flip ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className="flex-1">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-[23px] font-extrabold leading-tight tracking-tight text-navy sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-text-2 sm:text-lg">{step.text}</p>
                </div>

                <div
                  className={`w-full max-w-sm rounded-[28px] border border-line bg-cream p-7 shadow-[0_24px_50px_-32px_rgba(31,42,58,0.35)] ${
                    flip ? "lg:-rotate-1" : "lg:rotate-1"
                  }`}
                >
                  <IconTile icon={<Icon />} primary />
                  <div className="mt-6 h-2.5 w-2/3 rounded-full bg-navy/10" aria-hidden="true" />
                  <div className="mt-2.5 h-2.5 w-1/2 rounded-full bg-navy/10" aria-hidden="true" />
                  <div className="chips-in mt-6">
                    <Chip icon={<ChipIcon />} title={step.chip.title} sub={step.chip.sub} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
