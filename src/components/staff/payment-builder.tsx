"use client";

import { useState } from "react";
import { MAX_INSTALMENTS, MIN_INSTALMENTS, instalmentSchedule, scheduleSummary } from "@/lib/instalment-schedule";

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
  offers: upsells,
  products,
  repair,
  credits = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultDescription: string;
  firstName: string;
  savedCard: { brand: string; last4: string } | null;
  /** The call-out fee already paid on this visit, taken off the repair. */
  creditPence: number;
  /** Stripe is set up: the link can be sent. Without it, in person only. */
  online: boolean;
  /** Fergal's repair upsells (Settings): offered on their pay page as tick boxes. */
  offers: { productId: string; label: string; usualPence: number; offerPence: number }[];
  /** His products, for one-tap lines. */
  products: { id: string; name: string; pricePence: number }[];
  /** A repair: the upsells start ticked. */
  repair: boolean;
  /** Money off they're owed (a referral reward): one tap adds it as a line. */
  credits?: { id: string; label: string; pence: number }[];
}) {
  const [offerState, setOfferState] = useState(upsells.map((o) => ({ ...o, on: repair, price: (o.offerPence / 100).toString() })));
  const offered = offerState.filter((o) => o.on && toPence(o.price) >= 100);
  const [lines, setLines] = useState<Line[]>([
    { description: "Labour", pounds: "" },
    { description: "", pounds: "" },
    ...(creditPence > 0 ? [{ description: "Call-out fee already paid", pounds: (-creditPence / 100).toString() }] : []),
  ]);
  const [inPerson, setInPerson] = useState(!online);
  const [monthlyOn, setMonthlyOn] = useState(false);
  const [months, setMonths] = useState(6);
  const [deposit, setDeposit] = useState("");
  const parsed = lines.map((l) => ({ description: l.description.trim(), amountPence: toPence(l.pounds) })).filter((l) => l.description || l.amountPence);
  const total = parsed.reduce((sum, l) => sum + l.amountPence, 0);
  const ready = parsed.length > 0 && parsed.every((l) => l.description && l.amountPence !== 0) && total >= 100;
  const monthly = monthlyOn && total >= 100 ? instalmentSchedule(total, months, toPence(deposit)) : null;
  // The credits on the invoice: their line is still there, at their amount.
  const creditIds = credits.filter((c) => lines.some((l) => l.description === c.label && toPence(l.pounds) === -c.pence)).map((c) => c.id);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={action} className="flex flex-col gap-5" data-payment-builder>
      <input type="hidden" name="kind" value="invoice" />
      <input type="hidden" name="lines" value={JSON.stringify(parsed)} />
      <input type="hidden" name="creditIds" value={creditIds.join(",")} />
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
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { description: "", pounds: "" }])}
            className="min-h-11 text-sm font-medium text-accent underline underline-offset-4"
          >
            + Add a line
          </button>
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setLines((prev) => {
                  // Fill the first empty line, else add one.
                  const empty = prev.findIndex((l) => !l.description.trim() && !l.pounds.trim());
                  const line = { description: p.name, pounds: (p.pricePence / 100).toString() };
                  return empty >= 0 ? prev.map((l, j) => (j === empty ? line : l)) : [...prev, line];
                })
              }
              className="min-h-9 rounded-full border border-border px-3 text-xs font-medium hover:border-foreground/40"
              data-product-chip
            >
              + {p.name} {formatPence(p.pricePence)}
            </button>
          ))}
        </div>
        {credits.some((c) => !creditIds.includes(c.id)) && (
          <div className="flex flex-wrap items-center gap-1.5" data-credit-chips>
            <span className="text-xs font-semibold text-success">They&rsquo;re owed:</span>
            {credits
              .filter((c) => !creditIds.includes(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setLines((prev) => [...prev, { description: c.label, pounds: (-c.pence / 100).toString() }])}
                  className="min-h-9 rounded-full border border-success/40 bg-success/10 px-3 text-xs font-semibold text-success"
                >
                  + {c.label} {formatPence(-c.pence)}
                </button>
              ))}
          </div>
        )}
        {creditPence > 0 && <p className="text-xs text-muted">The {formatPence(creditPence)} call-out fee they paid comes off, as promised. Remove that line if it shouldn&rsquo;t.</p>}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-bold tracking-tight" data-total>
          {formatPence(total)}
        </span>
      </div>

      {online && (
        <div className="rounded-xl border border-border bg-background p-4" data-offer-builder>
          <p className="text-sm font-semibold">Offer on their pay page</p>
          <input
            type="hidden"
            name="offers"
            value={JSON.stringify(offered.map((o) => ({ productId: o.productId, label: o.label, pence: toPence(o.price), usualPence: o.usualPence })))}
          />
          {offerState.length === 0 ? (
            <p className="mt-1 text-xs text-muted">
              Pick up to two extras to offer at repairs in{" "}
              <a href="/staff/settings" className="underline underline-offset-4">
                Settings
              </a>
              .
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">They can tick these when they pay. You&rsquo;re already there, so they&rsquo;re about 20% off.</p>
              <ul className="mt-2 flex flex-col gap-2">
                {offerState.map((o, i) => {
                  const pence = toPence(o.price);
                  return (
                    <li key={o.productId} className="flex flex-wrap items-center gap-3" data-offer-row>
                      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={o.on}
                          onChange={(e) => setOfferState((prev) => prev.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                          className="h-5 w-5 accent-[var(--color-accent)]"
                        />
                        <span className="text-sm">
                          {o.label} <span className="text-muted line-through">{formatPence(o.usualPence)}</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        Offer £
                        <input
                          aria-label={`${o.label} offer price in pounds`}
                          value={o.price}
                          inputMode="decimal"
                          onChange={(e) => setOfferState((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                          className={`${FIELD} w-24 text-right`}
                        />
                      </label>
                      {o.on && pence > 0 && pence < o.usualPence && (
                        <span className="w-full text-xs text-muted">{Math.round((1 - pence / o.usualPence) * 100)}% off</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {online && (
        <div className="rounded-xl border border-border bg-background p-4" data-monthly-builder>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={monthlyOn} onChange={(e) => setMonthlyOn(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
            <span className="text-sm font-semibold">Let them pay monthly</span>
          </label>
          {monthlyOn && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Payments</span>
                  <select name="instalmentMonths" value={months} onChange={(e) => setMonths(Number(e.target.value))} className={FIELD}>
                    {Array.from({ length: MAX_INSTALMENTS - MIN_INSTALMENTS + 1 }, (_, i) => i + MIN_INSTALMENTS).map((n) => (
                      <option key={n} value={n}>
                        {n} months
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Deposit £ (optional)</span>
                  <input name="instalmentDeposit" value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="0" className={`${FIELD} text-right`} />
                </label>
              </div>
              <p className={`text-sm ${monthly && !monthly.ok ? "text-danger" : "text-muted"}`} data-monthly-preview>
                {!monthly
                  ? "Add the lines first."
                  : monthly.ok
                    ? `They can choose: ${scheduleSummary(monthly.schedule, formatPence)}. Taken from their card on that date each month until it's paid; they can pay off more any time.`
                    : monthly.error}
              </p>
              <p className="text-xs text-muted">Offered on their pay page next to paying in full. Up to 12 months with nothing added keeps it outside consumer credit rules.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {online && (
          <button type="submit" name="intent" value="send" disabled={!ready || (monthly !== null && !monthly.ok)} className={`${BIG} bg-accent text-accent-foreground`}>
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
