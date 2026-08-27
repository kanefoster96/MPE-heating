import { services, business, type ServiceCard } from "@/lib/content";
import {
  BoilerIcon,
  ServiceIcon,
  NewBoilerIcon,
  PlumbingIcon,
  ElectricsIcon,
  LandlordIcon,
} from "./icons";
import { ProductArt } from "./ProductArt";
import { ArrowRightIcon } from "./icons";

const iconMap = {
  boiler: BoilerIcon,
  service: ServiceIcon,
  newboiler: NewBoilerIcon,
  plumbing: PlumbingIcon,
  electrics: ElectricsIcon,
  landlord: LandlordIcon,
};

const toneStyles: Record<
  ServiceCard["tone"],
  { card: string; eyebrow: string; headline: string; line: string; button: string; art: "white" }
> = {
  orange: {
    card: "bg-terracotta",
    eyebrow: "text-white/80",
    headline: "text-white",
    line: "text-white/85",
    button: "bg-white text-terracotta hover:bg-white/90",
    art: "white",
  },
  "grey-deep": {
    card: "bg-grey-deep",
    eyebrow: "text-navy/50",
    headline: "text-navy",
    line: "text-navy/70",
    button: "bg-terracotta text-white hover:bg-terracotta-dark",
    art: "white",
  },
  "grey-green": {
    card: "bg-grey",
    eyebrow: "text-navy/50",
    headline: "text-navy",
    line: "text-navy/70",
    button: "bg-green text-white hover:bg-green-dark",
    art: "white",
  },
};

export function ServiceCards() {
  return (
    <section className="bg-cream py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            What we do
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Everything for your home, one call away
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {services.map((s) => {
            const Icon = iconMap[s.icon];
            const tone = toneStyles[s.tone];
            return (
              <article
                key={s.id}
                className={`flex flex-col items-center rounded-[24px] px-6 py-10 text-center sm:px-8 ${tone.card}`}
              >
                <ProductArt icon={<Icon className="h-full w-full" />} tone={tone.art} size="sm" />
                <p className={`mt-6 text-xs font-bold uppercase tracking-[0.18em] ${tone.eyebrow}`}>
                  {s.eyebrow}
                </p>
                <h3 className={`mt-2 text-xl font-bold sm:text-2xl ${tone.headline}`}>
                  {s.headline}
                </h3>
                <p className={`mt-2 text-sm ${tone.line}`}>{s.line}</p>
                <a
                  href={business.phoneHref}
                  className={`mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${tone.button}`}
                >
                  {s.cta}
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
