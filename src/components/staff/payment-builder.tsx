"use client";

import { useState } from "react";

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
const BIG =
  "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40";

/**
 * The invoice: what it's for, a line per part or job (a negative amount is
 * a credit, like the call-out fee already paid), the total, and how to take
 * it: send them the link, charge the card they saved, or mark it paid there
 * and then (card machine, cash or bank transfer). One form; the button
 * pressed says which.
 */
export function PaymentBuilder({
  action,
  defaultDescription,
  firstName,
  savedCard,
  creditPence,
  online,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultDescription: string;
  firstName: string;
  savedCard: { brand: string; last4: string } | null;
  /** The call-out fee already paid on this visit, taken off the repair. */
  creditPence: number;
  /** Stripe is set up: the link can be sent. Without it, in person only. */
  online: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([
    { description: "Labour", pounds: "" },
    { description: "", pounds: "" },
    ...(creditPence > 0 ? [{ description: "Call-out fee already paid", pounds: (-creditPence / 100).toString() }] : []),
  ]);
  const [inPerson, setInPerson] = useState(!online);
  const parsed = lines.map((l) => ({ description: l.description.trim(), amountPence: toPence(l.pounds) })).filter((l) => l.description || l.amountPence);
  const total = parsed.reduce((sum, l) => sum + l.amountPence, 0);
  const ready = parsed.length > 0 && parsed.every((l) => l.description && l.amountPence !== 0) && total >= 100;

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={action} className="flex flex-col gap-5" data-payment-builder>
      <input type="hidden" name="kind" value="invoice" />
      <input type="hidden" name="lines" value={JSON.stringify(parsed)} />
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">What it&rsquo;s for</span>
        <input name="description" defaultValue={defaultDescription} maxLength={120} className={FIELD} />
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
              placeholder={i === 0 ? "Labour" : "e.g. Diverter valve"}
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
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { description: "", pounds: "" }])}
          className="min-h-11 self-start text-sm font-medium text-accent underline underline-offset-4"
        >
          + Add a line
        </button>
        {creditPence > 0 && <p className="text-xs text-muted">The {formatPence(creditPence)} call-out fee they paid comes off, as promised. Remove that line if it shouldn&rsquo;t.</p>}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-bold tracking-tight" data-total>
          {formatPence(total)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {online && (
          <button type="submit" name="intent" value="send" disabled={!ready} className={`${BIG} bg-accent text-accent-foreground`}>
            Send {firstName} the invoice
          </button>
        )}
        {savedCard && (
          <button type="submit" name="intent" value="charge" disabled={!ready} className={`${BIG} border border-border bg-background`}>
            Charge their {savedCard.brand} ending {savedCard.last4}
          </button>
        )}
        {!inPerson ? (
          <button type="button" onClick={() => setInPerson(true)} className="min-h-11 text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground">
            They&rsquo;ve paid me in person
          </button>
        ) : (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-background p-3">
            <span className="w-full text-xs text-muted">Paid with:</span>
            <button type="submit" name="intent" value="in_person" disabled={!ready} className={`${BIG} border border-border`}>
              Card machine
            </button>
            <button type="submit" name="intent" value="cash" disabled={!ready} className={`${BIG} border border-border`}>
              Cash
            </button>
            <button type="submit" name="intent" value="bank_transfer" disabled={!ready} className={`${BIG} border border-border`}>
              Bank transfer
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
