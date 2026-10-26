/**
 * The sums for paying an invoice monthly: a copy of the site's
 * src/lib/instalment-schedule.ts (the app can't import the site), so the
 * preview Fergal sees in the app is what the server will offer. Keep the
 * two the same.
 */

export const MIN_INSTALMENTS = 2;
export const MAX_INSTALMENTS = 12;
export const MIN_MONTHLY_PENCE = 500;
/** A payment date after the 28th would skip February: they're kept to the 1st to 28th. */
export const LAST_PAYMENT_DAY = 28;

export type InstalmentSchedule = {
  months: number;
  depositPence: number;
  /** Today: the deposit and the first monthly payment. */
  firstPence: number;
  monthlyPence: number;
  /** How many monthly payments after today's. */
  laterPayments: number;
  /** The last one: what's left by then. */
  lastPence: number;
  totalPence: number;
};

export function instalmentSchedule(totalPence: number, months: number, depositPence = 0): { ok: true; schedule: InstalmentSchedule } | { ok: false; error: string } {
  if (!Number.isInteger(months) || months < MIN_INSTALMENTS || months > MAX_INSTALMENTS) {
    return { ok: false, error: `Monthly payments can be spread over ${MIN_INSTALMENTS} to ${MAX_INSTALMENTS} months.` };
  }
  const deposit = Math.max(0, Math.round(depositPence || 0));
  const remaining = totalPence - deposit;
  if (remaining <= 0) return { ok: false, error: "The deposit needs to be less than the total." };
  const monthly = Math.ceil(remaining / months);
  if (monthly < MIN_MONTHLY_PENCE) return { ok: false, error: "That's under £5 a month: pick fewer months." };
  return {
    ok: true,
    schedule: {
      months,
      depositPence: deposit,
      firstPence: deposit + monthly,
      monthlyPence: monthly,
      laterPayments: months - 1,
      lastPence: remaining - monthly * (months - 1),
      totalPence,
    },
  };
}

/** "£650 today (including a £500 deposit), then £150 a month on the same date for 9 months" (and the smaller last one). */
export function scheduleSummary(s: InstalmentSchedule, format: (pence: number) => string): string {
  const deposit = s.depositPence > 0 ? ` (including a ${format(s.depositPence)} deposit)` : "";
  const last = s.lastPence !== s.monthlyPence ? `, the last one ${format(s.lastPence)}` : "";
  return `${format(s.firstPence)} today${deposit}, then ${format(s.monthlyPence)} a month on the same date for ${s.laterPayments} month${s.laterPayments === 1 ? "" : "s"}${last}`;
}

