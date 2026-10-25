import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { CustomerFields } from "@/components/customer-fields";
import { addCustomer } from "../actions";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireStaff("/staff/customers/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/staff/customers" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Back to Customers
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">New customer</h1>
      <p className="mt-2 text-muted">A name, email or mobile is enough to start. Add the rest when you know it.</p>
      {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
      <form action={addCustomer} className="mt-6 flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <CustomerFields />
        <button
          type="submit"
          className="min-h-11 self-start rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Add customer
        </button>
      </form>
    </div>
  );
}
