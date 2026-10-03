import Link from "next/link";
import { quickPicks } from "@/lib/content";
import { funnelIconMap } from "@/lib/funnelIcons";
import { Heading } from "./Heading";
import { IconTile } from "./IconTile";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./Reveal";

// "What do you need?" straight under the hero: one tappable card per job,
// each going to the right form. Two columns on a phone, four on desktop.
export function QuickPick() {
  return (
    <section className="bg-cream py-12 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <Heading
            lead={quickPicks.heading.lead}
            em={quickPicks.heading.em}
            className="text-center text-3xl sm:text-4xl"
          />
        </Reveal>

        <Reveal as="ul" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickPicks.items.map((item) => {
            const Icon = funnelIconMap[item.icon];
            const primary = "primary" in item && item.primary;
            return (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={`group flex h-full min-h-[132px] flex-col rounded-2xl border p-4 transition-colors sm:p-5 ${
                    primary
                      ? "border-navy bg-navy text-white hover:bg-navy-light"
                      : "border-line bg-white text-navy hover:border-navy/40"
                  }`}
                >
                  <span className="flex items-start justify-between">
                    <IconTile
                      icon={<Icon />}
                      primary={!primary}
                      className={primary ? "bg-white/10 text-white" : ""}
                    />
                    <ArrowRightIcon
                      className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                        primary ? "text-white/70" : "text-navy/50"
                      }`}
                    />
                  </span>
                  <span className="mt-4 block text-base font-bold leading-tight sm:text-lg">{item.title}</span>
                  <span className={`mt-1 block text-xs leading-snug sm:text-sm ${primary ? "text-white/75" : "text-text-2"}`}>
                    {item.line}
                  </span>
                </Link>
              </li>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
