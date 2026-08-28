"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/content";
import { MenuIcon, CloseIcon, PhoneIcon, UserIcon } from "./icons";

// href is added as each menu page ships — an unset href renders as plain
// text rather than a link to a page that doesn't exist yet.
const links: { label: string; href?: string }[] = [
  { label: "Boiler repair", href: "/boiler-repair" },
  { label: "Servicing", href: "/servicing" },
  { label: "New boilers", href: "/new-boilers" },
  { label: "Commercial", href: "/commercial" },
  { label: "FAQs", href: "/faqs" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/mpe-logo.png"
            alt={business.fullName}
            width={1189}
            height={513}
            priority
            className="h-9 w-auto sm:h-11"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-navy/80">
          {links.map((link) =>
            link.href ? (
              <Link key={link.label} href={link.href} className="transition-colors hover:text-terracotta">
                {link.label}
              </Link>
            ) : (
              <span key={link.label}>{link.label}</span>
            )
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            aria-label="Log in or create an account"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-navy transition-colors hover:bg-grey sm:inline-flex"
          >
            <UserIcon className="h-5 w-5" />
          </Link>
          <a
            href={business.phoneHref}
            className="group inline-flex items-center gap-2 rounded-full border-2 border-terracotta px-3 py-2 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta hover:text-white active:bg-terracotta active:text-white sm:px-4"
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{business.phoneDisplay}</span>
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-navy transition-colors hover:bg-grey lg:hidden"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out lg:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <nav
            className={`border-t border-line bg-white px-4 py-3 transition-opacity duration-200 ${
              open ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            <ul className="flex flex-col divide-y divide-line">
              {links.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 text-base font-medium text-navy"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <span className="block py-3 text-base font-medium text-navy">
                      {link.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <p className="pt-4 text-xs font-bold uppercase tracking-[0.18em] text-navy/40">
              Account
            </p>
            <ul className="flex flex-col divide-y divide-line">
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-navy"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/create-account"
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-terracotta"
                >
                  Create account
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
