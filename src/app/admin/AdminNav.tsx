"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { business } from "@/lib/content";

const TABS = [
  { label: "Requests & jobs", href: "/admin/callouts" },
  { label: "Calendar", href: "/admin/calendar" },
  { label: "Customers", href: "/admin/customers" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Image
          src="/mpe-logo.png"
          alt={business.fullName}
          width={1189}
          height={513}
          className="h-7 w-auto"
        />
        <Link href="/" className="text-sm font-medium text-navy/50 hover:text-navy">
          ← Back to site
        </Link>
      </div>
      <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active ? "bg-navy text-white" : "text-navy/60 hover:bg-grey"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
