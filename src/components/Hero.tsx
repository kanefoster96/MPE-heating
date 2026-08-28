import Image from "next/image";
import { business, hero } from "@/lib/content";
import { CheckIcon, StarIcon, PhoneIcon } from "./icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-terracotta">
      <div className="mx-auto flex max-w-6xl justify-center px-4 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
        <Image
          src="/worcester-boiler.png"
          alt="Worcester Bosch boiler"
          width={800}
          height={800}
          priority
          className="h-56 w-56 drop-shadow-[0_20px_45px_rgba(31,42,58,0.35)] sm:h-64 sm:w-64"
        />
      </div>

      <div className="relative mx-auto -mt-2 max-w-6xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="rounded-t-[28px] bg-white px-5 py-8 shadow-[0_-15px_35px_-20px_rgba(31,42,58,0.3)] sm:rounded-[28px] sm:px-10 sm:py-10 lg:mx-auto lg:max-w-2xl lg:text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {hero.label}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl lg:text-5xl">
            {hero.headline}
          </h1>
          <p className="mt-4 text-base text-navy/70 sm:text-lg">{hero.subline}</p>

          <a
            href={business.phoneHref}
            className="mt-6 block w-full rounded-full bg-terracotta py-4 text-center text-base font-semibold text-white shadow-[0_12px_25px_-10px_rgba(232,98,58,0.7)] transition-colors hover:bg-terracotta-dark"
          >
            {hero.cta}
          </a>

          <a
            href={business.phoneHref}
            className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-navy/70 hover:text-navy"
          >
            <PhoneIcon className="h-4 w-4 text-terracotta" />
            Call our team on {business.phoneDisplay}
          </a>

          <ul className="mt-6 flex flex-col gap-2 text-sm text-navy/80 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
            {hero.ticks.map((t) => (
              <li key={t} className="flex items-center gap-2 sm:justify-center">
                <CheckIcon className="h-4 w-4 shrink-0 text-terracotta" />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col items-center gap-1.5 border-t border-line pt-6">
            <div className="flex gap-0.5 text-terracotta">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">
              Rated on TrustATrader
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
