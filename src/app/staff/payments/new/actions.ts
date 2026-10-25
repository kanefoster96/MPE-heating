"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import {
  CALLOUT_FEE_PENCE,
  MAX_OFFERS,
  cancelPaymentRequest,
  chargeSavedCard,
  createPaymentRequest,
  markPaidInPerson,
  parseLines,
  resendPaymentLink,
  sendReceipt,
  type PaymentKind,
} from "@/lib/payments";
import { viaPhrase } from "@/lib/visit-notify";
import { recordInPersonInstalment, restartInstalments, stopInstalments } from "@/lib/instalments";

type Context = { customerId: string; appointmentId: string | null; back: string };

function pageHref(ctx: Context, params: Record<string, string>): string {
  const q = new URLSearchParams(ctx.appointmentId ? { visit: ctx.appointmentId } : { customer: ctx.customerId });
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  return `/staff/payments/new?${q.toString()}`;
}

const IN_PERSON = ["in_person", "cash", "bank_transfer"] as const;

/**
 * Takes payment for a job: a call-out fee or an invoice, then however
 * Fergal pressed: send them the link, charge their saved card, or it's been
 * paid in person (they're sent a receipt).
 */
export async function takePayment(ctx: Context, formData: FormData) {
  const user = await requireStaff(ctx.back);
  const kind = (formData.get("kind") === "callout_fee" ? "callout_fee" : "invoice") as PaymentKind;
  const intent = String(formData.get("intent") ?? "send");
  const lines =
    kind === "callout_fee"
      ? { ok: true as const, lines: [{ description: "Call-out fee", amountPence: CALLOUT_FEE_PENCE }] }
      : parseLines(JSON.parse(String(formData.get("lines") || "[]")));
  if (!lines.ok) redirect(pageHref(ctx, { error: lines.error }));
  const inPerson = (IN_PERSON as readonly string[]).includes(intent) ? (intent as (typeof IN_PERSON)[number]) : null;

  const created = await createPaymentRequest({
    staffId: user.id,
    customerId: ctx.customerId,
    appointmentId: ctx.appointmentId,
    kind,
    description: kind === "callout_fee" ? "Call-out fee" : String(formData.get("description") ?? ""),
    lines: lines.lines,
    send: !inPerson,
    chargeNow: intent === "charge",
    offers: offersFrom(formData, kind, !!inPerson || intent === "charge"),
    instalments: kind === "invoice" && intent === "send" ? instalmentsFrom(formData) : null,
  });
  if (!created.ok) redirect(pageHref(ctx, { error: created.error }));

  let flash: string;
  if (inPerson) {
    await markPaidInPerson(created.request.id, inPerson);
    const via = await sendReceipt(created.request.id, user.id);
    flash = `Marked paid.${via.length ? ` Receipt sent by ${viaPhrase(via)}.` : ""}`;
  } else if (intent === "charge") {
    flash = created.charge?.ok
      ? `Charged to their saved card.${created.sentVia.length ? ` Receipt sent by ${viaPhrase(created.sentVia)}.` : ""}`
      : `${created.charge?.error ?? "Not charged."}${created.sentVia.length ? ` The link went by ${viaPhrase(created.sentVia)}.` : ""}`;
  } else {
    flash = created.sentVia.length ? `Sent by ${viaPhrase(created.sentVia)}.` : "Saved, but we couldn't reach them: add an email or mobile to their details.";
  }
  revalidatePath("/staff/schedule");
  redirect(pageHref(ctx, { done: flash }));
}

/** "Let them pay monthly": how many payments, and any deposit. */
function instalmentsFrom(formData: FormData): { months: number; depositPence: number } | null {
  const months = Number(formData.get("instalmentMonths"));
  if (!Number.isInteger(months) || months < 2) return null;
  const deposit = Number(String(formData.get("instalmentDeposit") ?? "").replace(/[£,\s]/g, ""));
  return { months, depositPence: Number.isFinite(deposit) && deposit > 0 ? Math.round(deposit * 100) : 0 };
}

/** The extras to offer on their pay page (up to two): only on an invoice they'll pay from the link. */
function offersFrom(formData: FormData, kind: PaymentKind, paidNow: boolean) {
  if (kind !== "invoice" || paidNow) return [];
  try {
    const raw = JSON.parse(String(formData.get("offers") || "[]")) as unknown[];
    return raw
      .slice(0, MAX_OFFERS)
      .map((o) => {
        const item = o as { productId?: unknown; label?: unknown; pence?: unknown; usualPence?: unknown };
        const pence = Math.round(Number(item.pence));
        const usual = Math.round(Number(item.usualPence));
        return {
          productId: typeof item.productId === "string" ? item.productId : null,
          label: String(item.label ?? "").trim().slice(0, 80),
          pence,
          usualPence: Number.isFinite(usual) && usual > pence ? usual : null,
        };
      })
      .filter((o) => o.label && Number.isFinite(o.pence) && o.pence >= 100);
  } catch {
    return [];
  }
}

/** On a payment already asked for: charge the saved card, mark paid, send again, or cancel. */
export async function managePayment(ctx: Context, paymentId: string, formData: FormData) {
  const user = await requireStaff(ctx.back);
  const intent = String(formData.get("intent") ?? "");
  let flash = "Done.";
  if (intent === "charge") {
    const result = await chargeSavedCard(paymentId);
    flash = result.ok ? "Charged to their saved card." : result.error;
    if (result.ok) await sendReceipt(paymentId, user.id);
  } else if ((IN_PERSON as readonly string[]).includes(intent)) {
    const result = await markPaidInPerson(paymentId, intent as (typeof IN_PERSON)[number]);
    flash = result.ok ? "Marked paid. Receipt sent." : result.error;
    if (result.ok) await sendReceipt(paymentId, user.id);
  } else if (intent === "resend") {
    const via = await resendPaymentLink(paymentId, user.id);
    flash = via.length ? `Sent again by ${viaPhrase(via)}.` : "Couldn't reach them: add an email or mobile to their details.";
  } else if (intent === "stop_monthly") {
    const result = await stopInstalments(paymentId);
    flash = result.ok ? "Monthly payments stopped. Anything left can still be paid off." : result.error;
  } else if (intent === "restart_monthly") {
    const result = await restartInstalments(paymentId);
    flash = result.ok ? "Monthly payments restarted." : result.error;
  } else if (intent.startsWith("monthly_")) {
    const via = intent.slice("monthly_".length);
    const pounds = Number(String(formData.get("amount") ?? "").replace(/[£,\s]/g, ""));
    const result = (IN_PERSON as readonly string[]).includes(via)
      ? await recordInPersonInstalment(paymentId, Number.isFinite(pounds) ? Math.round(pounds * 100) : 0, via as (typeof IN_PERSON)[number], user.id)
      : { ok: false as const, error: "Pick how they paid." };
    flash = result.ok ? "Recorded: it's come off what they owe." : result.error;
  } else if (intent === "cancel") {
    const result = await cancelPaymentRequest(paymentId);
    flash = result.ok ? "Cancelled." : result.error;
  }
  revalidatePath("/staff/schedule");
  redirect(pageHref(ctx, { done: flash }));
}
