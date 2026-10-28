"use client";

import { useState } from "react";
import { MAX_INSTALMENTS, MIN_INSTALMENTS, instalmentSchedule } from "@/lib/instalment-schedule";

type Line = { description: string; pounds: string };

function toPence(pounds: string): number {
  const n = Number(pounds.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function formatPence(pence: number): string {
  const sign = pence < 0 ? "−" : "";
  const pounds = Math.abs(pence) / 100;
  return `${sign}£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

/**
 * Writing a quote: what it's for, a line per part and the labour (his
 * products are one tap), what's included, any deposit to accept it, how
 * long it's open, and whether the rest can be paid monthly once the work's
 * done. The total and what's left after the deposit update as he types.
 */
export function QuoteBuilder({
  action,
  defaultTitle,
  firstName,
  products,
  online,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultTitle: string;
  firstName: string;
  products: { id: string; name: string; pricePence: number }[];
  /** Stripe is set up: a deposit can be paid online and the rest monthly. */
  online: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([
    { description: "", pounds: "" },
    { description: "Labour", pounds: "" },
  ]);
  const [deposit, setDeposit] = useState("");
  const [monthlyOn, setMonthlyOn] = useState(false);
  const [months, setMonths] = useState(6);
  const parsed = lines.map((l) => ({ description: l.description.trim(), amountPence: toPence(l.pounds) })).filter((l) => l.description || l.amountPence);
  const total = parsed.reduce((sum, l) => sum + l.amountPence, 0);
  const depositPence = toPence(deposit);
  const rest = total - depositPence;
  const monthly = monthlyOn && rest >= 100 ? instalmentSchedule(rest, months, 0) : null;
  const ready = parsed.length > 0 && parsed.every((l) => l.description && l.amountPence !== 0) && total >= 100 && depositPence < total && (!monthly || monthly.ok);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={action} className="flex flex-col gap-5" data-quote-builder>
      <input type="hidden" name="lines" value={JSON.stringify(parsed)} />
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">What it&rsquo;s for</span>
        <input name="title" defaultValue={defaultTitle} required maxLength={120} placeholder="e.g. New combi boiler, fitted" className={FIELD} />
      </label>

      <div className="flex flex-col gap-2" role="group" aria-label="Lines">
        <div className="grid grid-cols-[1fr_7rem_2.75rem] gap-2 text-xs text-muted">
          <span>Item</span>
          <span>£</span>
          <span className="sr-only">Remove</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_2.75rem] items-center gap-2" data-line>
            <input
              aria-label={`Line ${i + 1} description`}
              value={l.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder={i === 0 ? "e.g. Combi boiler, 30kW" : "e.g. Labour"}
              maxLength={100}
              className={FIELD}
            />
            <input
              aria-label={`Line ${i + 1} amount in pounds`}
              value={l.pounds}
              onChange={(e) => update(i, { pounds: e.target.value })}
              inputMode="decimal"
              placeholder="0.00"
              className={`${FIELD} text-right`}
            />
            <button
              type="button"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setLines((prev) => [...prev, { description: "", pounds: "" }])} className="min-h-11 text-sm font-medium text-accent underline underline-offset-4">
            + Add a line
          </button>
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setLines((prev) => {
                  const empty = prev.findIndex((l) => !l.description.trim() && !l.pounds.trim());
                  const line = { description: p.name, pounds: (p.pricePence / 100).toString() };
                  return empty >= 0 ? prev.map((l, j) => (j === empty ? line : l)) : [...prev, line];
                })
              }
              className="min-h-9 rounded-full border border-border px-3 text-xs font-medium hover:border-foreground/40"
            >
              + {p.name} {formatPence(p.pricePence)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-bold tracking-tight" data-quote-total>
          {formatPence(total)}
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">What&rsquo;s included (optional): they see this on the quote</span>
        <textarea name="details" rows={4} maxLength={2000} placeholder="e.g. Remove the old boiler, fit and commission the new one, flush the system, magnetic filter, register the warranty." className={FIELD} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Deposit to accept it £ (optional)</span>
          <input name="deposit" value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder={online ? "No deposit" : "Needs online payments"} disabled={!online} className={`${FIELD} text-right`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Open for</span>
          <select name="validDays" defaultValue="30" className={FIELD}>
            {[14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>
      {depositPence > 0 && (
        <p className={`text-sm ${depositPence >= total ? "text-danger" : "text-muted"}`} data-quote-rest>
          {depositPence >= total ? "The deposit needs to be less than the total." : `They pay ${formatPence(depositPence)} to accept it, and ${formatPence(rest)} when the work's done.`}
        </p>
      )}

      {online && (
        <div className="rounded-xl border border-border bg-background p-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={monthlyOn} onChange={(e) => setMonthlyOn(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
            <span className="text-sm font-semibold">Offer the rest monthly</span>
          </label>
          {monthlyOn && (
            <div className="mt-2 flex flex-col gap-2">
              <select name="balanceInstalments" value={months} onChange={(e) => setMonths(Number(e.target.value))} className={FIELD} aria-label="Monthly payments">
                {Array.from({ length: MAX_INSTALMENTS - MIN_INSTALMENTS + 1 }, (_, i) => i + MIN_INSTALMENTS).map((n) => (
                  <option key={n} value={n}>
                    Over {n} months
                  </option>
                ))}
              </select>
              <p className={`text-sm ${monthly && !monthly.ok ? "text-danger" : "text-muted"}`}>
                {!monthly
                  ? "Add the lines first."
                  : monthly.ok
                    ? `When the work's done they can pay ${formatPence(rest)} as ${formatPence(monthly.schedule.monthlyPence)} a month for ${months} months${monthly.schedule.lastPence !== monthly.schedule.monthlyPence ? ` (the last ${formatPence(monthly.schedule.lastPence)})` : ""}. Interest-free.`
                    : monthly.error}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!ready}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Send {firstName} the quote
      </button>
      <p className="text-center text-xs text-muted">By message, email and the app, with a link to accept it online.</p>
    </form>
  );
}
