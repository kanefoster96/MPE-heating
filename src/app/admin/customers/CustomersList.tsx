"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCardIcon, PhoneIcon, SearchIcon } from "@/components/icons";
import { MOCK_CUSTOMERS } from "../mockData";

export function CustomersList() {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const customers = q
    ? MOCK_CUSTOMERS.filter((c) =>
        [c.name, c.phone, c.email, c.address ?? ""].some((field) =>
          field.toLowerCase().includes(q)
        )
      )
    : MOCK_CUSTOMERS;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Customers</h1>
      <p className="mt-2 text-sm text-navy/70">
        Everyone who&apos;s contacted MPE — click through for their job history, boiler details, and
        notes from past visits.
      </p>

      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email or address…"
          className="w-full rounded-full border border-line bg-white py-2.5 pl-11 pr-4 text-sm text-navy outline-none placeholder:text-navy/35 focus:border-terracotta"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {customers.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-navy/50">
            No customers match &ldquo;{query}&rdquo;.
          </p>
        )}
        {customers.map((customer) => (
          <Link
            key={customer.id}
            href={`/admin/customers/${customer.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] transition-colors hover:bg-cream"
          >
            <div>
              <p className="text-base font-bold text-navy">{customer.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/60">
                <PhoneIcon className="h-3.5 w-3.5" />
                {customer.phone}
                {customer.email && <span> · {customer.email}</span>}
              </p>
            </div>
            {customer.hasCardOnFile && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-grey px-2.5 py-1 text-xs font-semibold text-navy/60">
                <CreditCardIcon className="h-3.5 w-3.5" />
                Card on file
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
