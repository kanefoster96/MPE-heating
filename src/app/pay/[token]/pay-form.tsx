"use client";

import { useState } from "react";

function formatPence(pence: number): string {
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Offer = { index: number; label: string; pence: number; usualPence: number | null };

/**
 * Pay, with the extras Fergal offers at a repair (up to two from Settings,
 * e.g. a boiler service while he's there, about 20% off) as tick boxes that
 * change the total before they pay, and the tick to save their card.
 */
export function PayForm({
  action,
  amountPence,
  offers,
}: {
  action: (formData: FormData) => void | Promise<void>;
  amountPence: number;
  offers: Offer[];
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const total = amountPence + offers.filter((o) => picked.includes(o.index)).reduce((sum, o) => sum + o.pence, 0);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4 print:hidden" data-pay-form>
      {offers.length > 0 && (
        <fieldset className="flex flex-col gap-2" data-offers>
          <legend className="mb-2 text-sm font-semibold text-navy">While we&rsquo;re with you</legend>
          {offers.map((offer) => {
            const on = picked.includes(offer.index);
            const saving = offer.usualPence && offer.usualPence > offer.pence ? Math.round((1 - offer.pence / offer.usualPence) * 100) : null;
            return (
              <label
                key={offer.index}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${on ? "border-terracotta-deep bg-terracotta-deep/5" : "border-line bg-cream hover:border-navy/30"}`}
                data-offer
              >
                <input
                  type="checkbox"
                  name="addOffer"
                  value={offer.index}
                  checked={on}
                  onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, offer.index] : prev.filter((i) => i !== offer.index)))}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-terracotta-deep)]"
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold text-navy">Add {offer.label.charAt(0).toLowerCase() + offer.label.slice(1)}</span>
                    <span className="whitespace-nowrap">
                      {offer.usualPence && <span className="mr-1.5 text-sm text-text-2 line-through">{formatPence(offer.usualPence)}</span>}
                      <span className="font-bold text-navy">{formatPence(offer.pence)}</span>
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-text-2">
                    {saving ? `${saving}% off, because we're already with you.` : "Because we're already with you."}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex items-center justify-between">
        <span className="font-semibold text-navy">Total to pay</span>
        <span className="text-2xl font-extrabold text-navy" data-pay-total>
          {formatPence(total)}
        </span>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-navy">
        <input type="checkbox" name="saveCard" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-terracotta-deep)]" />
        <span>
          Save my card with MPE for future visits. <span className="text-text-2">We&rsquo;ll always ask you first before using it.</span>
        </span>
      </label>
      <button
        type="submit"
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-terracotta-deep px-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
      >
        Pay {formatPence(total)}
      </button>
      <p className="text-center text-xs text-text-2">Apple Pay, Google Pay or card, securely by Stripe.</p>
    </form>
  );
}
