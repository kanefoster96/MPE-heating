import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { getAppointment } from "@/lib/appointments";
import { customerLabel, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { listProducts } from "@/lib/products";
import { paymentsOn } from "@/lib/payments";
import { QuoteBuilder } from "@/components/staff/quote-builder";
import { sendNewQuote } from "../actions";

export const metadata: Metadata = { title: "New quote" };

/** Writing a quote, from a quote visit or a customer's page. */
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ visit?: string; customer?: string; error?: string }> }) {
  const params = await searchParams;
  await requireStaff("/staff/quotes");
  const visit = params.visit ? await getAppointment(params.visit) : null;
  const customer = visit?.customerId ? await getCustomer(visit.customerId) : params.customer ? await getCustomer(params.customer) : null;
  if (!customer) notFound();
  const products = await listProducts();
  const back = visit ? `/staff/schedule?view=day&date=${visit.day}#visit-${visit.id}` : `/staff/customers/${customer.id}#quotes`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href={back} className="text-sm text-muted transition-colors hover:text-foreground">
        ← Back
      </Link>
      <p className="mt-6 text-sm uppercase tracking-widest text-muted">New quote</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{customerLabel(customer)}</h1>
      <p className="mt-1 text-muted">
        {visit ? `${KIND_LABEL[visit.kind]} · ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}` : [customer.address, customer.postcode].filter(Boolean).join(", ")}
      </p>
      {(customer.boilerMake || customer.boilerModel || customer.boilerNotes) && (
        <p className="mt-1 text-sm text-muted">
          Their boiler: {[customer.boilerMake, customer.boilerModel, customer.boilerAge].filter(Boolean).join(" · ")}
          {customer.boilerNotes ? ` · "${customer.boilerNotes}"` : ""}
        </p>
      )}
      {params.error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <QuoteBuilder
          action={sendNewQuote.bind(null, { customerId: customer.id, appointmentId: visit?.id ?? null })}
          defaultTitle={visit?.kind === "install" || visit?.kind === "quote" ? "New boiler, supplied and fitted" : ""}
          firstName={customer.name?.split(" ")[0] ?? "them"}
          products={products.map((p) => ({ id: p.id, name: p.name, pricePence: p.pricePence }))}
          online={paymentsOn()}
        />
      </section>
    </div>
  );
}
