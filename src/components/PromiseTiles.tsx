import { promise } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { Heading, Eyebrow } from "./Heading";
import { IconTile } from "./Chip";
import { Reveal } from "./Reveal";

// The promise: four small tiles in a row, each an icon, a bold line and a
// short line.
export function PromiseTiles() {
  return (
    <section className="bg-page py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>Why MPE</Eyebrow>
          <Heading lead={promise.heading.lead} em={promise.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
          <p className="mt-4 text-base leading-relaxed text-text-2 sm:text-lg">{promise.text}</p>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {promise.tiles.map((tile, i) => {
            const Icon = featureIconMap[tile.icon];
            return (
              <div key={tile.title} className="rounded-[24px] border border-line bg-cream p-6">
                <IconTile icon={<Icon />} primary={i === 0} />
                <h3 className="mt-5 text-lg font-bold leading-tight text-navy">{tile.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{tile.text}</p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
