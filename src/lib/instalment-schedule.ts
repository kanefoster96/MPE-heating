/**
 * The sums for paying an invoice monthly, shared by Fergal's invoice
 * builder (in the browser) and the server, so the preview he sees is what
 * the customer agrees to.
 *
 * Up to 12 payments, the first today, then one on the same date each
 * month, and nothing added: interest-free credit repaid in 12 payments or
 * fewer within a year is exempt from FCA consumer credit authorisation.
 * Longer, or with interest or fees, needs a finance provider.
 *
 * Any deposit is taken with the first payment. The monthly amount is
 * rounded up to the penny, so the last payment is the one that's a little
 * less: it's whatever's left, never more.
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

/** The same day n months on (the 31st becomes the month's last day). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Their payment date each month, from the day they started: the 1st to the 28th. */
export function paymentDay(startISODate: string): number {
  return Math.min(Number(startISODate.slice(8, 10)), LAST_PAYMENT_DAY);
}

/** The next payment date after `fromISODate`, on their payment day (both "YYYY-MM-DD"). */
export function nextPaymentDate(fromISODate: string, day: number): string {
  const [y, m] = fromISODate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, Math.min(day, LAST_PAYMENT_DAY)));
  return next.toISOString().slice(0, 10);
}

/** "1st", "2nd", "23rd", "28th". */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
