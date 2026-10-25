import Link from "next/link";
import { homeExtras } from "@/lib/content";
import { ArrowRightIcon, CheckIcon, NewBoilerIcon, ServiceIcon } from "./icons";

// Lower on the homepage: new boilers (free quote) and servicing (from
// £79), each its own small card with three points and one button.
export function BoilerExtras() {
  const [line1, line2] = homeExtras.heading;
  const cards = [
    { ...homeExtras.newBoiler, Icon: NewBoilerIcon },
    { ...homeExtras.servicing, Icon: ServiceIcon },
  ];
  return (
    <section className="bg-cream py-12 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
          {line1}
          <br />
          {line2}
        </h2>
        <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2 lg:gap-6">
          {cards.map(({ Icon, ...card }) => (
            <article key={card.tag} className="flex flex-col rounded-3xl bg-white p-6 shadow-[0_18px_40px_-28px_rgba(31,42,58,0.35)] sm:p-8">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff0e6] text-terracotta-deep">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">{card.tag}</p>
              </div>
              <h3 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] sm:text-[28px]">{card.title}</h3>
              <ul className="mt-3 flex-1 space-y-2">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-base text-text-2">
                    <CheckIcon className="mt-1 h-4 w-4 flex-none text-whatsapp-dark" strokeWidth={3} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
                <Link
                  href={card.href}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-colors hover:bg-ticket-stub"
                >
                  {card.cta}
                  <ArrowRightIcon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                </Link>
                <Link
                  href={card.more.href}
                  className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-navy underline underline-offset-4"
                >
                  {card.more.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
