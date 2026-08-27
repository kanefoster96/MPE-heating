"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/content";
import { MenuIcon, CloseIcon, PhoneIcon } from "./icons";

const links = ["Boiler repair", "Servicing", "New boilers", "Commercial", "FAQs"];

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
          {links.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
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

      {open && (
        <nav className="border-t border-line bg-white px-4 py-3 lg:hidden">
          <ul className="flex flex-col divide-y divide-line">
            {links.map((label) => (
              <li key={label} className="block py-3 text-base font-medium text-navy">
                {label}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
