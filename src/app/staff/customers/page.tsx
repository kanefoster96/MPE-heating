import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { customerLabel, listCustomers } from "@/lib/customers";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Customers" };

/** Every customer, most recently changed first, with a search. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await requireStaff("/staff/customers");
  const query = q?.trim() ?? "";
  const customers = await listCustomers(query || undefined, 200);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">MPE team</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Customers</h1>
        </div>
        <Link
          href="/staff/customers/new"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          + New customer
        </Link>
      </div>

      <form method="get" className="relative mt-6">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, phone, email, address or postcode"
          aria-label="Search customers"
          className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-base outline-none focus:border-foreground/40 sm:text-sm"
        />
      </form>
      {query && (
        <p className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {customers.length} result{customers.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
          </span>
          <Link href="/staff/customers" className="underline underline-offset-4 hover:text-foreground">
            Clear
          </Link>
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {customers.length === 0 ? (
          <li className="rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted">
            {query ? "No customers match." : "No customers yet. They're added from booking forms, the chat, or here."}
          </li>
        ) : (
          customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/staff/customers/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:border-foreground/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{customerLabel(c)}</p>
                  <p className="truncate text-sm text-muted">
                    {[c.postcode, c.phone, c.name ? c.email : null].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
                </div>
                {(c.boilerMake || c.boilerModel) && (
                  <span className="hidden shrink-0 rounded-full bg-foreground/5 px-2.5 py-1 text-xs text-muted sm:inline">
                    {[c.boilerMake, c.boilerModel].filter(Boolean).join(" ")}
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
