import Link from "next/link";
import { homeMore } from "@/lib/content";
import { ArrowRightIcon, BuildingIcon, CalendarIcon, DropIcon, ElectricsIcon, NewBoilerIcon, RadiatorIcon, ServiceIcon } from "./icons";

const icons = {
  service: ServiceIcon,
  newBoiler: NewBoilerIcon,
  plan: CalendarIcon,
  heating: RadiatorIcon,
  plumbing: DropIcon,
  electrics: ElectricsIcon,
  business: BuildingIcon,
} as const;

// Everything that isn't a breakdown, as plain rows: an icon, a name, one
// line and an arrow. No filled buttons, so the call-out stays the one ask.
// One column on a phone, two on desktop.
export function HomeMore() {
  const [line1, line2] = homeMore.heading;
  return (
    <section className="bg-page py-12 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
          {line1}
          <br />
          {line2}
        </h2>
        <ul className="mt-6 grid gap-3 lg:mt-8 lg:grid-cols-2 lg:gap-4">
          {homeMore.items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons];
            return (
              // The business row, last, takes the full width on desktop.
              <li key={item.key} className={item.key === "business" ? "lg:col-span-2" : undefined}>
                <Link
                  href={item.href}
                  className="flex h-full min-h-16 items-center gap-3.5 rounded-[18px] border-[1.5px] border-edge p-4 transition-colors hover:border-navy/30 lg:p-5"
                >
                  <span aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-cream text-navy">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold leading-snug">{item.title}</span>
                    <span className="block text-sm leading-snug text-text-2">{item.text}</span>
                  </span>
                  <ArrowRightIcon className="h-5 w-5 flex-none text-text-3" strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
