"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { cancelQuote, createQuote, invoiceBalance, resendQuote } from "@/lib/quotes";
import { viaPhrase } from "@/lib/visit-notify";

type Context = { customerId: string; appointmentId: string | null };

/** Writes the quote and sends it. */
export async function sendNewQuote(ctx: Context, formData: FormData) {
  const user = await requireStaff("/staff/quotes");
  const pounds = (v: FormDataEntryValue | null) => {
    const n = Number(String(v ?? "").replace(/[£,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("lines") || "[]"));
  } catch {
    lines = [];
  }
  const created = await createQuote({
    staffId: user.id,
    customerId: ctx.customerId,
    appointmentId: ctx.appointmentId,
    title: String(formData.get("title") ?? ""),
    lines,
    depositPence: pounds(formData.get("deposit")),
    details: String(formData.get("details") ?? ""),
    validDays: Number(formData.get("validDays")) || undefined,
    balanceInstalments: Number(formData.get("balanceInstalments")) || null,
  });
  if (!created.ok) {
    const q = new URLSearchParams(ctx.appointmentId ? { visit: ctx.appointmentId } : { customer: ctx.customerId });
    q.set("error", created.error);
    redirect(`/staff/quotes/new?${q.toString()}`);
  }
  revalidatePath("/staff/quotes");
  const done = created.sentVia.length ? `Sent by ${viaPhrase(created.sentVia)}.` : "Saved, but we couldn't reach them: add an email or mobile to their customer page.";
  redirect(`/staff/quotes/${created.quote.id}?done=${encodeURIComponent(done)}`);
}

/** On a quote: send it again, withdraw it, or invoice the rest once the work's done. */
export async function manageQuote(id: string, formData: FormData) {
  const user = await requireStaff(`/staff/quotes/${id}`);
  const intent = String(formData.get("intent") ?? "");
  let done = "Done.";
  if (intent === "resend") {
    const via = await resendQuote(id, user.id);
    done = via.length ? `Sent again by ${viaPhrase(via)}.` : "Couldn't send it: it may no longer be open, or we can't reach them.";
  } else if (intent === "cancel") {
    done = (await cancelQuote(id)) ? "Quote withdrawn." : "Only an open quote can be withdrawn.";
  } else if (intent === "invoice") {
    const result = await invoiceBalance(id, user.id);
    done = result.ok ? `Invoice for the rest sent${result.sentVia.length ? ` by ${viaPhrase(result.sentVia)}` : ""}.` : result.error;
  }
  revalidatePath(`/staff/quotes/${id}`);
  redirect(`/staff/quotes/${id}?done=${encodeURIComponent(done)}`);
}
