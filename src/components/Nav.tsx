"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { business, freeOffers } from "@/lib/content";
import { FreeOfferLink, offerIcons } from "./FreeOfferLink";
import { ChatButton } from "./ChatButton";
import { MenuIcon, CloseIcon } from "./icons";

// The logo on the left, call, chat and menu on the right, nothing else.
// A white glass bar with 44px tap targets.
const links: { label: string; href: string }[] = [
  { label: "Boiler repair", href: "/boiler-repair" },
  { label: "Servicing", href: "/servicing" },
  { label: "New boilers", href: "/new-boilers" },
  { label: "Commercial", href: "/commercial" },
  { label: "Areas we cover", href: "/areas" },
  { label: "FAQs", href: "/faqs" },
  { label: "Help & advice", href: "/help" },
  { label: "Reviews", href: "/reviews" },
  { label: "About", href: "/about" },
  { label: "Book a boiler service", href: "/book/service" },
  { label: "Maintenance plan", href: "/book/plan" },
  { label: "Book a visit", href: "/book" },
  { label: "Contact", href: "/contact" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  // While the menu's open the page behind it stays still, so a swipe scrolls the menu.
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={`${business.name} home`}>
          <Image
            src="/mpe-logo.png"
            alt={business.fullName}
            width={1189}
            height={513}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <a
            href={business.phoneHref}
            aria-label={`Call us on ${business.phoneDisplay}`}
            className="inline-flex h-11 items-center rounded-full border border-navy/20 px-4 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            Call us
          </a>
          <ChatButton />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-grey"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {/* The bar's pinned to the top, so the menu scrolls on its own: on a phone it's taller than the screen. */}
          <nav
            aria-label="Site"
            className={`max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-line bg-white pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-200 ${
              open ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            {/* The free ways to start come first in the menu. */}
            <ul aria-label={freeOffers.heading} className="mx-auto grid max-w-6xl gap-2 px-4 pt-4 sm:grid-cols-3 sm:px-6">
              {freeOffers.items.map((item) => {
                const Icon = offerIcons[item.key];
                return (
                  <li key={item.key}>
                    <FreeOfferLink
                      item={item}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-[#fff0e6] px-3.5 py-2.5 text-[15px] font-semibold text-terracotta-deep"
                    >
                      <Icon className="h-5 w-5 flex-none" aria-hidden="true" />
                      {item.title}
                    </FreeOfferLink>
                  </li>
                );
              })}
            </ul>
            <ul className="mx-auto grid max-w-6xl gap-x-8 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block min-h-11 py-3 text-base font-medium text-navy"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
