import Link from "next/link";
import type { ReactNode } from "react";
import type { freeOffers } from "@/lib/content";
import { ChatIcon, NewBoilerIcon, VanIcon } from "./icons";

type Offer = (typeof freeOffers.items)[number];

// One icon per free offer, shared by the hero card, the footer band and
// the menu.
export const offerIcons = {
  callout: VanIcon,
  quote: NewBoilerIcon,
  chat: ChatIcon,
} as const;

// A free offer's link: a page link, or an email link until live chat is on.
export function FreeOfferLink({
  item,
  className,
  onClick,
  children,
}: {
  item: Offer;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return item.external ? (
    <a href={item.href} onClick={onClick} className={className}>
      {children}
    </a>
  ) : (
    <Link href={item.href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
