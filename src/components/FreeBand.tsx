import { freeOffers } from "@/lib/content";
import { FreeOfferLink, offerIcons } from "./FreeOfferLink";
import { ArrowRightIcon } from "./icons";

// The three free ways to start, as a row of cards at the top of the
// footer, so every page ends with them.
export function FreeBand() {
  return (
    <div className="border-b border-line pb-10">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">{freeOffers.heading}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3 lg:gap-5">
        {freeOffers.items.map((item) => {
          const Icon = offerIcons[item.key];
          return (
            <li key={item.key}>
              <FreeOfferLink
                item={item}
                className="group flex h-full items-center gap-3.5 rounded-[18px] border-[1.5px] border-edge bg-white p-4 transition-colors hover:border-navy/30 sm:flex-col sm:items-start sm:p-5"
              >
                <span aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#fff0e6] text-terracotta-deep">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="flex-1">
                  <span className="block text-[17px] font-bold leading-snug text-navy">{item.title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-text-2">{item.note}</span>
                  <span className="mt-2 hidden items-center gap-1.5 text-sm font-semibold text-terracotta-deep sm:inline-flex">
                    {item.cta}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
              </FreeOfferLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
