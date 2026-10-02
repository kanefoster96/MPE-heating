import Image from "next/image";
import { hero } from "@/lib/content";
import { chipIconMap } from "@/lib/chipIcons";
import { Heading } from "./Heading";
import { StatusLine } from "./StatusLine";
import { RoundField } from "./RoundField";
import { Chip } from "./Chip";
import { Reveal } from "./Reveal";

// Hero: a status line, one two-tone headline, one line of copy, the round
// field for the main ask, and one visual underneath with three chips
// around it. Nothing else competes with the ask.
export function Hero() {
  return (
    <section className="bg-page pt-12 pb-14 sm:pt-16 lg:pt-24 lg:pb-28">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        <StatusLine>{hero.status}</StatusLine>

        <Heading
          as="h1"
          lead={hero.headline.lead}
          em={hero.headline.em}
          emLine
          className="mt-5 max-w-4xl text-[40px] sm:text-6xl lg:text-[64px]"
        />

        <p className="mt-5 max-w-xl text-base leading-relaxed text-text-2 sm:text-lg">{hero.subline}</p>

        <RoundField cta={hero.cta} type="repair" placeholder={hero.fieldPlaceholder} className="mt-8" />

        <p className="mt-4 max-w-md text-xs leading-relaxed text-text-3 sm:text-sm">{hero.reassurance}</p>

        <Reveal className="relative mt-12 w-full max-w-3xl sm:mt-16">
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-[28px] border border-line bg-cream sm:h-72 sm:w-72">
            <Image
              src="/worcester-boiler.png"
              alt="Worcester Bosch boiler"
              width={800}
              height={800}
              priority
              className="h-40 w-40 drop-shadow-[0_24px_40px_rgba(31,42,58,0.25)] sm:h-52 sm:w-52"
            />
          </div>
          <div className="anim mt-6 flex flex-wrap items-center justify-center gap-3 sm:absolute sm:inset-0 sm:mt-0 sm:block">
            {hero.chips.map((chip, i) => {
              const Icon = chipIconMap[chip.icon];
              const position = [
                "sm:absolute sm:left-0 sm:top-6 sm:-rotate-3",
                "sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 sm:rotate-2",
                "sm:absolute sm:left-6 sm:bottom-2 sm:rotate-1",
              ][i];
              return (
                <div key={chip.title} className={`chips-in ${position}`}>
                  <Chip icon={<Icon />} title={chip.title} sub={chip.sub} />
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
