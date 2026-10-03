import { pains } from "@/lib/content";
import { featureIconMap } from "@/lib/featureIcons";
import { Heading, Eyebrow } from "./Heading";
import { IconTile } from "./IconTile";
import { Reveal } from "./Reveal";

// Pain points we understand: four tiles in the customer's words.
export function PainPoints() {
  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>We get it</Eyebrow>
          <Heading lead={pains.heading.lead} em={pains.heading.em} className="mt-3 text-3xl sm:text-4xl lg:text-5xl" />
          <p className="mt-4 text-base leading-relaxed text-text-2 sm:text-lg">{pains.text}</p>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pains.items.map((item) => {
            const Icon = featureIconMap[item.icon];
            return (
              <div key={item.title} className="rounded-[24px] border border-line bg-white p-6">
                <IconTile icon={<Icon />} />
                <h3 className="mt-5 text-lg font-bold leading-tight text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{item.text}</p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
