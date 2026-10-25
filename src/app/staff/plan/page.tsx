import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { customerLabel, getCustomers } from "@/lib/customers";
import { formatPence } from "@/lib/payments";
import { longDate } from "@/lib/day-plan";
import { BILLING_LABEL, listPlanMembers, planDate, planOpen, planPrices, priceLine, type PlanMember } from "@/lib/maintenance-plan";

export const metadata: Metadata = { title: "Plan members" };

/**
 * Everyone on the maintenance plan (Kanvas Academy's memberships list):
 * what they pay, when the next payment is, anyone whose payment failed or
 * who's leaving, and when they last had their free service. Plus what the
 * plan brings in a month.
 */
export default async function PlanMembersPage() {
  await requireStaff("/staff/plan");
  const [members, prices] = await Promise.all([listPlanMembers(), planPrices()]);
  const customers = await getCustomers(members.map((m) => m.customerId));
  const live = members.filter((m) => m.status === "active" || m.status === "past_due");
  const ended = members.filter((m) => m.status === "ended");
  const monthly = live.reduce((sum, m) => sum + (m.pricePence ? (m.billing === "year" ? m.pricePence / 12 : m.pricePence) : 0), 0);
  const failed = live.filter((m) => m.status === "past_due").length;
  const leaving = live.filter((m) => m.cancelAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/staff/customers" className="text-sm text-muted transition-colors hover:text-foreground">
        ← Customers
      </Link>
      <p className="mt-6 text-sm uppercase tracking-widest text-muted">Maintenance plan</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Plan members</h1>
      <p className="mt-1 text-sm text-muted">
        {planOpen(prices) ? `${priceLine(prices)} for new members.` : "No price set, so no one can join online yet."}{" "}
        <Link href="/staff/settings#plan" className="underline underline-offset-4">
          Prices in Settings
        </Link>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-plan-stats>
        <Stat label="Members" value={String(live.length)} />
        <Stat label="A month, roughly" value={formatPence(Math.round(monthly))} />
        <Stat label="Payment failed" value={String(failed)} alert={failed > 0} />
        <Stat label="Leaving" value={String(leaving)} />
      </dl>

      <section className="mt-8" aria-labelledby="members">
        <h2 id="members" className="text-lg font-semibold">
          On the plan
        </h2>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No one yet. Send someone the plan from their customer page.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-plan-members>
            {live.map((m) => (
              <MemberRow key={m.id} m={m} name={customerLabel(customers.get(m.customerId) ?? { name: null, email: null, phone: null })} />
            ))}
          </ul>
        )}
      </section>

      {ended.length > 0 && (
        <section className="mt-8" aria-labelledby="ended">
          <h2 id="ended" className="text-lg font-semibold">
            Left in the last 90 days
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {ended.map((m) => (
              <MemberRow key={m.id} m={m} name={customerLabel(customers.get(m.customerId) ?? { name: null, email: null, phone: null })} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold ${alert ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}

function MemberRow({ m, name }: { m: PlanMember; name: string }) {
  const status =
    m.status === "ended"
      ? `Ended${m.endedAt ? ` ${planDate(m.endedAt)}` : ""}`
      : m.status === "past_due"
        ? "Payment failed"
        : m.cancelAt
          ? `Ends ${planDate(m.cancelAt)}`
          : m.currentPeriodEnd
            ? `Next payment ${planDate(m.currentPeriodEnd)}`
            : "Active";
  return (
    <li>
      <Link
        href={`/staff/customers/${m.customerId}#plan`}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-foreground/40"
        data-plan-member={m.status}
      >
        <span className="min-w-0">
          <span className="block font-semibold">{name}</span>
          <span className="block text-xs text-muted">
            {m.pricePence && m.billing ? `${formatPence(m.pricePence)} ${BILLING_LABEL[m.billing]}` : ""}
            {m.startedAt ? ` · since ${planDate(m.startedAt)}` : ""}
            {` · ${m.lastServiceOn ? `serviced ${longDate(m.lastServiceOn)}` : "no service yet"}`}
          </span>
        </span>
        <span className={`text-xs font-semibold ${m.status === "past_due" ? "text-danger" : m.status === "ended" || m.cancelAt ? "text-muted" : "text-success"}`}>{status}</span>
      </Link>
    </li>
  );
}
