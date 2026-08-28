import Image from "next/image";
import Link from "next/link";
import { hero } from "@/lib/content";
import { CheckIcon, StarIcon, AlertTriangleIcon } from "./icons";
import { SameDayStat } from "./SameDayStat";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-flame-gradient">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-5 px-4 pb-10 pt-12 sm:gap-10 sm:px-6 sm:pb-14 sm:pt-16 lg:flex-col lg:gap-6 lg:pt-20">
        <Image
          src="/worcester-boiler.png"
          alt="Worcester Bosch boiler"
          width={800}
          height={800}
          priority
          className="h-28 w-28 shrink-0 drop-shadow-[0_20px_45px_rgba(31,42,58,0.35)] sm:h-40 sm:w-40"
        />
        <div className="flex flex-col items-start gap-3.5 sm:gap-4 lg:items-center">
          <p className="text-xl leading-tight text-white sm:text-3xl lg:text-4xl lg:text-center">
            <span className="flex items-center gap-2.5 italic sm:gap-3 lg:justify-center">
              <span className="relative flex h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
                <span className="relative inline-flex h-full w-full rounded-full bg-red" />
              </span>
              {hero.imageCallout.question}
            </span>
            <span className="mt-1 block font-extrabold">{hero.imageCallout.answer}</span>
          </p>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white hover:text-terracotta sm:text-sm"
          >
            <AlertTriangleIcon className="h-4 w-4" />
            {hero.imageCallout.emergencyCta}
          </Link>
        </div>
      </div>

      <div className="relative mx-auto -mt-2 max-w-6xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="rounded-t-[28px] bg-white px-5 py-8 text-center shadow-[0_-15px_35px_-20px_rgba(31,42,58,0.3)] sm:rounded-[28px] sm:px-10 sm:py-10 lg:mx-auto lg:max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {hero.label}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl lg:text-5xl">
            {hero.headline}
          </h1>
          <p className="mt-4 text-base text-navy/70 sm:text-lg">{hero.subline}</p>

          <Link
            href="/contact"
            className="bg-btn-gradient mt-6 block w-full rounded-full py-4 text-center text-base font-semibold text-white shadow-[0_12px_25px_-10px_rgba(232,98,58,0.7)]"
          >
            {hero.cta}
          </Link>

          <div className="mt-5 flex justify-center">
            <SameDayStat />
          </div>

          <ul className="mt-4 flex flex-col items-center gap-2 text-sm text-navy/80 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
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
