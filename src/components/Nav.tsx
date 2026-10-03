"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/content";
import { MenuIcon, CloseIcon, WhatsAppIcon } from "./icons";

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
  { label: "About", href: "/about" },
  { label: "Book a boiler service", href: "/book?path=boilers.service" },
  { label: "Book a visit", href: "/book" },
  { label: "Contact", href: "/contact" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

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
          <a
            href={business.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-whatsapp transition-colors hover:bg-grey"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>
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
          <nav
            aria-label="Site"
            className={`border-t border-line bg-white transition-opacity duration-200 ${
              open ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
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
