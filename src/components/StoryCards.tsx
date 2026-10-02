import { storyCards, storyRailHeading } from "@/lib/content";
import { chipIconMap } from "@/lib/chipIcons";
import { BoilerIcon, ServiceIcon, NewBoilerIcon, LandlordIcon } from "./icons";
import { Heading, Eyebrow } from "./Heading";
import { Chip, IconTile } from "./Chip";
import { StoryRail, StoryCard } from "./StoryRail";
import { Reveal } from "./Reveal";

const tileIcons = {
  boiler: BoilerIcon,
  service: ServiceIcon,
  newboiler: NewBoilerIcon,
  landlord: LandlordIcon,
};

export function StoryCards() {
  return (
    <section className="bg-cream py-14 lg:py-28">
      <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
        <Eyebrow>What we do</Eyebrow>
        <Heading
          lead={storyRailHeading.lead}
          em={storyRailHeading.em}
          className="mt-3 max-w-2xl text-3xl sm:text-4xl lg:text-5xl"
        />
      </Reveal>

      <StoryRail label="What happens when you book">
        {storyCards.map((card, i) => {
          const Tile = tileIcons[card.icon];
          return (
            <StoryCard
              key={card.title}
              tile={<IconTile icon={<Tile />} primary={i === 0} />}
              title={card.title}
              text={card.text}
              chips={card.chips.map((chip) => {
                const Icon = chipIconMap[chip.icon];
                return <Chip key={chip.title} icon={<Icon />} title={chip.title} sub={chip.sub} />;
              })}
            />
          );
        })}
      </StoryRail>
    </section>
  );
}
