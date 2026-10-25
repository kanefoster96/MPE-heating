"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff/messages", label: "Inbox" },
  { href: "/staff/schedule", label: "Schedule" },
  { href: "/staff/customers", label: "Customers" },
];

/** The team's three places: the inbox, the schedule and the customers. */
export function StaffNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Team" className="flex items-center gap-0.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors ${
              active ? "bg-foreground/10 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
