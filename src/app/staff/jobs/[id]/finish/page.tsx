import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { getAppointment } from "@/lib/appointments";
import { customerLabel, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { formatPence, invoiceNumber, paymentsForAppointments } from "@/lib/payments";
import { getJobReview } from "@/lib/job-completion";
import { finishJob } from "./actions";

export const metadata: Metadata = { title: "Finish job" };

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

/**
 * Finishing a job: what was done (the customer sees it), the boiler's
 * details, a private note for whoever goes next, then the summary to the
 * customer and the review ask a couple of hours later. Opened from Done on
 * the visit card; opened again later, it edits what was saved.
 */
export default async function FinishJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  await requireStaff(`/staff/jobs/${id}/finish`);
  const visit = await getAppointment(id);
  if (!visit) notFound();
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const payments = ((await paymentsForAppointments([visit.id])).get(visit.id) ?? []).filter((p) => p.status !== "cancelled");
  const review = await getJobReview(visit.id);
  const done = visit.status === "done";
  // Start from the invoice: its lines, less the call-out credit, as plain words.
  const fromInvoice = payments
    .filter((p) => p.kind === "invoice")
    .flatMap((p) => p.lines)
    .filter((l) => l.amountPence > 0 && !/^labour$/i.test(l.description))
    .map((l) => l.description);
  const suggested = visit.jobReport ?? (fromInvoice.length ? `${fromInvoice.join(", ")}.` : "");
  const first = customer?.name?.split(" ")[0] ?? "them";
  const back = `/staff/schedule?view=day&date=${visit.day}#visit-${visit.id}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href={back} className="text-sm text-muted transition-colors hover:text-foreground">
        ← Back
      </Link>
      <p className="mt-6 text-sm uppercase tracking-widest text-muted">{done ? "Job done" : "Finish job"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{customer ? customerLabel(customer) : visit.title || "Job"}</h1>
      <p className="mt-1 text-muted">
        {KIND_LABEL[visit.kind]} · {longDate(visit.day)}, {windowLabel(visit.start, visit.end)}
      </p>

      {payments.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {payments.map((p) => (
            <li key={p.id}>
              {p.kind === "callout_fee" ? "Call-out fee" : invoiceNumber(p.number)} {formatPence(p.amountPence)} ·{" "}
              <span className={p.status === "paid" ? "font-medium text-success" : "text-muted"}>{p.status === "paid" ? "Paid ✓" : "Not paid yet"}</span>
            </li>
          ))}
        </ul>
      ) : (
        customer && (
          <p className="mt-4 text-sm text-muted">
            Nothing taken yet.{" "}
            <Link href={`/staff/payments/new?visit=${visit.id}`} className="font-semibold text-accent underline underline-offset-4">
              Take payment
            </Link>
          </p>
        )
      )}
      {review && (
        <p className="mt-3 rounded-lg bg-surface px-4 py-2 text-sm" data-review>
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)} from {first}
          {review.comment ? `: “${review.comment}”` : ""}
        </p>
      )}
      {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}

      <form action={finishJob.bind(null, visit.id, visit.day)} className="mt-6 flex flex-col gap-6" data-finish-form>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">What we did</span>
          <span className="-mt-1 text-xs text-muted">{customer ? `${first} sees this on their visit page and account.` : "For the record."}</span>
          <textarea
            name="report"
            rows={4}
            defaultValue={suggested}
            placeholder="e.g. Replaced the diverter valve, topped the pressure up to 1.2 bar, tested heating and hot water."
            className={FIELD}
          />
        </label>

        {customer && (
          <>
            <fieldset className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">Their boiler</legend>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Make</span>
                <input name="boilerMake" defaultValue={customer.boilerMake ?? ""} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Model</span>
                <input name="boilerModel" defaultValue={customer.boilerModel ?? ""} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Roughly how old</span>
                <input name="boilerAge" defaultValue={customer.boilerAge ?? ""} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Where it is</span>
                <input name="boilerLocation" defaultValue={customer.boilerLocation ?? ""} className={FIELD} />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
                <input type="checkbox" name="servicedToday" defaultChecked={visit.kind === "service"} className="h-5 w-5 accent-[var(--color-accent)]" />
                <span className="text-sm">Serviced on this visit (sets &ldquo;last serviced&rdquo;; their reminder comes in 11 months)</span>
              </label>
            </fieldset>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Note for next time</span>
              <span className="-mt-1 text-xs text-muted">Only the team sees this. Optional.</span>
              <textarea name="privateNote" rows={3} placeholder="e.g. Heat exchanger showing wear. Mention a replacement quote at the next service." className={FIELD} />
            </label>

            <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" name="sendSummary" defaultChecked={!done} className="h-5 w-5 accent-[var(--color-accent)]" />
                <span className="text-sm font-semibold">Send {first} a summary of the job</span>
              </label>
              <p className="pl-8 text-xs text-muted">What we did, with their invoice or receipt. By message, email, text and the app.</p>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" name="askReview" defaultChecked={!done && !review} disabled={!!review} className="h-5 w-5 accent-[var(--color-accent)]" />
                <span className="text-sm font-semibold">Ask {first} for a review</span>
              </label>
              <p className="pl-8 text-xs text-muted">
                {review ? "They've already reviewed this job." : "Goes about two hours from now (daytime only), with one reminder after three days."}
              </p>
            </div>
          </>
        )}

        <button type="submit" className="min-h-12 self-start rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground hover:opacity-90">
          {done ? "Save" : "Mark job done"}
        </button>
      </form>
    </div>
  );
}
