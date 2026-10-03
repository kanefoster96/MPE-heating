import Link from "next/link";
import { homeServices } from "@/lib/content";
import { DropIcon, ElectricsIcon, FlameIcon, RadiatorIcon } from "./icons";

// Four trades as tiles: an icon in a tinted square, a name and one line.
// Two by two on a phone, one row of four on desktop.
const look = {
  boilers: { Icon: FlameIcon, tint: "bg-[#fff0e6] text-terracotta-deep" },
  heating: { Icon: RadiatorIcon, tint: "bg-[#fff0e6] text-terracotta-deep" },
  plumbing: { Icon: DropIcon, tint: "bg-[#e8f1fb] text-[#1f5fa8]" },
  electrics: { Icon: ElectricsIcon, tint: "bg-[#fff6db] text-[#8a6100]" },
} as const;

export function ServiceTiles() {
  const [line1, line2] = homeServices.heading;
  return (
    <section className="bg-page pt-11 pb-10 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
          {line1}
          <br />
          {line2}
        </h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:mt-8 lg:grid-cols-4 lg:gap-5">
          {homeServices.items.map((item) => {
            const { Icon, tint } = look[item.key as keyof typeof look];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col gap-2.5 rounded-[18px] border-[1.5px] border-edge p-4 transition-colors hover:border-navy/30 lg:p-6"
                >
                  <span className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl ${tint}`}>
                    <Icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="text-[17px] font-bold">{item.title}</span>
                  <span className="text-sm leading-[1.35] text-text-2">{item.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
