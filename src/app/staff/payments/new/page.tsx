import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { getAppointment } from "@/lib/appointments";
import { customerLabel, customerForConversation, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import {
  CALLOUT_FEE_PENCE,
  PAID_VIA_LABEL,
  calloutCreditFor,
  formatPence,
  invoiceNumber,
  payLink,
  paymentsForAppointments,
  paymentsForCustomer,
  paymentsOn,
  savedCardFor,
  type PaymentRequest,
} from "@/lib/payments";
import { PaymentBuilder } from "@/components/staff/payment-builder";
import { managePayment, takePayment } from "./actions";

export const metadata: Metadata = { title: "Take payment" };

const BIG =
  "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90";
const SMALL = "inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-foreground/40";

/**
 * Taking payment for a job, from a visit (or a customer, or their chat):
 * the £50 call-out fee in one tap, or an invoice with a line per part and
 * job (the call-out fee already paid comes off). Then send them the link
 * (Apple Pay, Google Pay or card), charge the card they saved, or mark it
 * paid in person. What's already been asked for is listed on top.
 */
export default async function TakePaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ visit?: string; customer?: string; conversation?: string; done?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireStaff("/staff/schedule");
  const visit = params.visit ? await getAppointment(params.visit) : null;
  const customer = visit?.customerId
    ? await getCustomer(visit.customerId)
    : params.customer
      ? await getCustomer(params.customer)
      : params.conversation
        ? await customerForConversation(params.conversation)
        : null;
  if (!customer) notFound();

  const back = visit ? `/staff/schedule?view=day&date=${visit.day}#visit-${visit.id}` : `/staff/customers/${customer.id}`;
  const ctx = { customerId: customer.id, appointmentId: visit?.id ?? null, back };
  const online = paymentsOn();
  const [existing, card, credit] = await Promise.all([
    visit ? paymentsForAppointments([visit.id]).then((m) => m.get(visit.id) ?? []) : paymentsForCustomer(customer.id).then((list) => list.filter((p) => p.status === "open")),
    online ? savedCardFor(customer) : Promise.resolve(null),
    visit ? calloutCreditFor(visit.id) : Promise.resolve(0),
  ]);
  const first = customer.name?.split(" ")[0] ?? "them";
  const calloutAsked = existing.some((p) => p.kind === "callout_fee" && p.status !== "cancelled");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href={back} className="text-sm text-muted transition-colors hover:text-foreground">
        ← Back
      </Link>
      <p className="mt-6 text-sm uppercase tracking-widest text-muted">Take payment</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{customerLabel(customer)}</h1>
      {visit && (
        <p className="mt-1 text-muted">
          {KIND_LABEL[visit.kind]} · {longDate(visit.day)}, {windowLabel(visit.start, visit.end)}
        </p>
      )}
      {card ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success" data-saved-card>
          Card on file: {card.brand} ending {card.last4} (expires {card.expires})
        </p>
      ) : (
        online && <p className="mt-3 text-sm text-muted">No card saved yet. They can tick &ldquo;save my card&rdquo; when they pay a link.</p>
      )}

      {params.done && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success" data-flash>{params.done}</p>}
      {params.error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}
      {!online && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Online payments switch on once Stripe is set up. Until then you can record payments taken in person, and they&rsquo;re sent a receipt.
        </p>
      )}

      {existing.length > 0 && (
        <section className="mt-8" aria-labelledby="asked">
          <h2 id="asked" className="text-lg font-semibold">
            {visit ? "This visit" : "Waiting to be paid"}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {existing.map((p) => (
              <ExistingPayment key={p.id} p={p} action={managePayment.bind(null, ctx, p.id)} card={card} online={online} />
            ))}
          </ul>
        </section>
      )}

      {!calloutAsked && (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="callout">
          <h2 id="callout" className="text-lg font-semibold">
            Call-out fee
          </h2>
          <p className="mt-1 text-sm text-muted">If they go ahead with the repair, it comes off the invoice automatically.</p>
          <form action={takePayment.bind(null, ctx)} className="mt-4 flex flex-col gap-2" data-callout-form>
            <input type="hidden" name="kind" value="callout_fee" />
            {online && (
              <button type="submit" name="intent" value="send" className={`${BIG} bg-accent text-accent-foreground`}>
                Send {first} the {formatPence(CALLOUT_FEE_PENCE)} call-out fee
              </button>
            )}
            {card && (
              <button type="submit" name="intent" value="charge" className={`${BIG} border border-border bg-background`}>
                Charge {formatPence(CALLOUT_FEE_PENCE)} to their {card.brand} ending {card.last4}
              </button>
            )}
            <InPersonButtons label={`Paid ${formatPence(CALLOUT_FEE_PENCE)} in person`} />
          </form>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="invoice">
        <h2 id="invoice" className="text-lg font-semibold">
          Invoice for the job
        </h2>
        <div className="mt-4">
          <PaymentBuilder
            action={takePayment.bind(null, ctx)}
            defaultDescription={visit ? (visit.kind === "callout" || visit.kind === "repair" ? "Boiler repair" : KIND_LABEL[visit.kind]) : ""}
            firstName={first}
            savedCard={card ? { brand: card.brand, last4: card.last4 } : null}
            creditPence={credit}
            online={online}
          />
        </div>
      </section>
    </div>
  );
}

function InPersonButtons({ label }: { label: string }) {
  return (
    <details className="rounded-xl border border-border bg-background px-3 py-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted">{label}</summary>
      <div className="flex flex-wrap gap-2 pb-3 pt-1">
        <button type="submit" name="intent" value="in_person" className={SMALL}>
          Card machine
        </button>
        <button type="submit" name="intent" value="cash" className={SMALL}>
          Cash
        </button>
        <button type="submit" name="intent" value="bank_transfer" className={SMALL}>
          Bank transfer
        </button>
      </div>
    </details>
  );
}

function ExistingPayment({
  p,
  action,
  card,
  online,
}: {
  p: PaymentRequest;
  action: (formData: FormData) => void | Promise<void>;
  card: { brand: string; last4: string } | null;
  online: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3" data-payment={p.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          {p.kind === "callout_fee" ? "Call-out fee" : `${invoiceNumber(p.number)} · ${p.description}`}
        </span>
        <span className="text-lg font-bold">{formatPence(p.amountPence)}</span>
      </div>
      <p className={`text-sm ${p.status === "paid" ? "text-success" : "text-muted"}`}>
        {p.status === "paid"
          ? `Paid ✓${p.paidVia ? ` · ${PAID_VIA_LABEL[p.paidVia]}` : ""}`
          : p.status === "cancelled"
            ? "Cancelled"
            : `Waiting for them to pay${p.reminderCount ? ` · reminded ${p.reminderCount === 1 ? "once" : "twice"}` : ""}`}
      </p>
      {p.status === "open" && (
        <form action={action} className="mt-2 flex flex-wrap gap-1.5">
          {card && (
            <button type="submit" name="intent" value="charge" className={`${SMALL} border-accent bg-accent text-accent-foreground`}>
              Charge {card.brand} ending {card.last4}
            </button>
          )}
          <button type="submit" name="intent" value="in_person" className={SMALL}>
            Paid by card machine
          </button>
          <button type="submit" name="intent" value="cash" className={SMALL}>
            Cash
          </button>
          <button type="submit" name="intent" value="bank_transfer" className={SMALL}>
            Bank transfer
          </button>
          {online && (
            <button type="submit" name="intent" value="resend" className={SMALL}>
              Send the link again
            </button>
          )}
          <button type="submit" name="intent" value="cancel" className="min-h-9 px-2 text-xs font-medium text-danger">
            Cancel
          </button>
        </form>
      )}
      {p.status !== "cancelled" && (
        <a href={payLink(p)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center text-xs text-muted underline underline-offset-4">
          {p.status === "paid" ? "Receipt" : "Their pay page"}
        </a>
      )}
    </li>
  );
}
