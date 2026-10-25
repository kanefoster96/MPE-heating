/**
 * The sums for paying an invoice monthly, shared by Fergal's invoice
 * builder (in the browser) and the server, so the preview he sees is what
 * the customer's charged.
 *
 * Up to 12 payments, the first today, the rest monthly, and nothing added:
 * interest-free credit repaid in 12 payments or fewer within a year is
 * exempt from FCA consumer credit authorisation. Longer, or with interest
 * or fees, needs a finance provider.
 *
 * Any deposit is taken with the first payment; the pennies that don't
 * divide evenly go on the first payment too.
 */

export const MIN_INSTALMENTS = 2;
export const MAX_INSTALMENTS = 12;
export const MIN_MONTHLY_PENCE = 500;

export type InstalmentSchedule = {
  months: number;
  depositPence: number;
  /** Today: the deposit, the first monthly payment and any odd pennies. */
  firstPence: number;
  monthlyPence: number;
  /** How many monthly payments after today's. */
  laterPayments: number;
  totalPence: number;
};

export function instalmentSchedule(totalPence: number, months: number, depositPence = 0): { ok: true; schedule: InstalmentSchedule } | { ok: false; error: string } {
  if (!Number.isInteger(months) || months < MIN_INSTALMENTS || months > MAX_INSTALMENTS) {
    return { ok: false, error: `Monthly payments can be spread over ${MIN_INSTALMENTS} to ${MAX_INSTALMENTS} months.` };
  }
  const deposit = Math.max(0, Math.round(depositPence || 0));
  const remaining = totalPence - deposit;
  if (remaining <= 0) return { ok: false, error: "The deposit needs to be less than the total." };
  const monthly = Math.floor(remaining / months);
  if (monthly < MIN_MONTHLY_PENCE) return { ok: false, error: "That's under £5 a month: pick fewer months." };
  const odd = remaining - monthly * months;
  return {
    ok: true,
    schedule: { months, depositPence: deposit, firstPence: deposit + odd + monthly, monthlyPence: monthly, laterPayments: months - 1, totalPence },
  };
}

/** "£250 today, then £200 a month for 9 months" (with "(including a £50 deposit)" when there is one). */
export function scheduleSummary(s: InstalmentSchedule, format: (pence: number) => string): string {
  const deposit = s.depositPence > 0 ? ` (including a ${format(s.depositPence)} deposit)` : "";
  return `${format(s.firstPence)} today${deposit}, then ${format(s.monthlyPence)} a month for ${s.laterPayments} month${s.laterPayments === 1 ? "" : "s"}`;
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
