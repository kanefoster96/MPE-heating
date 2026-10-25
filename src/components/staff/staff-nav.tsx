"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff", label: "Home" },
  { href: "/staff/messages", label: "Inbox" },
  { href: "/staff/schedule", label: "Schedule" },
  { href: "/staff/customers", label: "Customers" },
];

/** The team's places: home (the dashboard), the inbox, the schedule and the customers. `waiting` badges the schedule. */
export function StaffNav({ waiting = 0 }: { waiting?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Team" className="flex items-center gap-0.5">
      {TABS.map((tab) => {
        const active = tab.href === "/staff" ? pathname === "/staff" || pathname.startsWith("/staff/invoices") : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-2.5 text-sm font-medium transition-colors sm:px-3 ${
              active ? "bg-foreground/10 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.href === "/staff/schedule" && waiting > 0 && (
              <span className="ml-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground" aria-label={`${waiting} waiting`}>
                {waiting > 99 ? "99+" : waiting}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
