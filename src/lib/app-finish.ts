import { getAppointment, returnVisitFor } from "@/lib/appointments";
import { customerLabel, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { completeJob, getJobReview } from "@/lib/job-completion";
import { CERT_LABEL, CERT_TYPES, fileLabel, filesForCustomer } from "@/lib/job-files";
import { calloutCreditFor, cancelPaymentRequest, createPaymentRequest, formatPence, invoiceNumber, payLink, paymentsForAppointments, resendPaymentLink, type PaymentRequest } from "@/lib/payments";
import { londonNow } from "@/lib/schedule-time";
import { notReachedLine, reachedThem, viaPhrase, whatsappHandoff, type WhatsAppHandoff } from "@/lib/visit-notify";

/**
 * Finishing a job in the app (mobile/app/finish/[id].tsx): the website's
 * /staff/jobs/[id]/finish. What was done (the customer sees it), their
 * boiler, a private note for next time, the summary and the review ask,
 * and photos and certificates for the job. Not fixed yet: "Coming back",
 * with what for (lib/job-completion.ts), then two questions. The price:
 * known, so it's taken there and then or sent as an invoice before he
 * leaves, or not yet (it depends on the part), so it goes on the team's
 * list until a quote or invoice is sent, with reminders at 9am and 1pm
 * (lib/follow-up-sweep.ts). And the day: known, so the return visit's
 * booked next, or not yet, so it waits on the "To be scheduled" list.
 * Saved by completeJob, as the website does; opened again later, it edits
 * what was saved.
 */

export async function finishDraft(id: string) {
  const visit = await getAppointment(id);
  if (!visit) return null;
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const [payments, review, files, returnVisit] = await Promise.all([
    paymentsForAppointments([visit.id]).then((m) => (m.get(visit.id) ?? []).filter((p) => p.status !== "cancelled")),
    getJobReview(visit.id),
    customer ? filesForCustomer(customer.id).catch(() => []) : Promise.resolve([]),
    returnVisitFor(visit.id),
  ]);
  const done = visit.status === "done";
  // Start from the invoice: its lines, less the call-out credit, as plain words.
  const fromInvoice = payments
    .filter((p) => p.kind === "invoice")
    .flatMap((p) => p.lines)
    .filter((l) => l.amountPence > 0 && !/^labour$/i.test(l.description))
    .map((l) => l.description);
  return {
    id: visit.id,
    title: customer ? customerLabel(customer) : visit.title || "Job",
    when: `${KIND_LABEL[visit.kind]} · ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}`,
    done,
    hasCustomer: !!customer,
    customerId: customer?.id ?? null,
    first: customer?.name?.split(" ")[0] ?? null,
    report: visit.jobReport ?? (fromInvoice.length ? `${fromInvoice.join(", ")}.` : ""),
    boiler: {
      boilerMake: customer?.boilerMake ?? "",
      boilerModel: customer?.boilerModel ?? "",
      boilerAge: customer?.boilerAge ?? "",
      boilerLocation: customer?.boilerLocation ?? "",
    },
    servicedToday: visit.kind === "service",
    /** Fixed, or coming back to finish (a part to fit), and what for. */
    outcome: visit.outcome ?? "fixed",
    returnNote: visit.returnNote ?? "",
    /** First time finishing as "coming back": ask about the price. */
    askPrice: !done,
    priceNeeded: visit.priceNeeded,
    /** The return visit, once it's booked. */
    returnVisit: returnVisit ? { id: returnVisit.id, when: `${KIND_LABEL[returnVisit.kind]} · ${longDate(returnVisit.day)}, ${windowLabel(returnVisit.start, returnVisit.end)}` } : null,
    sendSummary: !done,
    askReview: !done && !review,
    reviewed: review ? `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}${review.comment ? `: “${review.comment}”` : ""}` : null,
    payments: payments.map((p) => ({ label: p.kind === "callout_fee" ? "Call-out fee" : invoiceNumber(p.number), amount: formatPence(p.amountPence), paid: p.status === "paid" })),
    files: files
      .filter((f) => f.appointmentId === visit.id)
      .map((f) => ({ id: f.id, kind: f.kind, label: fileLabel(f), url: f.url, image: !!f.contentType?.startsWith("image/"), shared: f.shared, expiresOn: f.expiresOn })),
    certTypes: CERT_TYPES.map((t) => ({ key: t, label: CERT_LABEL[t] })),
    today: londonNow().dateISO,
  };
}

export type FinishBody = {
  report?: string;
  privateNote?: string;
  boiler?: { boilerMake?: string; boilerModel?: string; boilerAge?: string; boilerLocation?: string };
  servicedToday?: boolean;
  sendSummary?: boolean;
  askReview?: boolean;
  outcome?: "fixed" | "return";
  returnNote?: string;
  /** Coming back: the price taken now, sent as an invoice now, or sent later once the part's priced. */
  price?: "take" | "send" | "later";
  /** The return visit's price in pounds, for "take" and "send". */
  pricePounds?: string;
};

export async function finish(id: string, body: FinishBody, staffId: string): Promise<{ ok: true; message: string; invoiceId?: string; whatsapp?: WhatsAppHandoff | null } | { ok: false; error: string }> {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const coming = body.outcome === "return";
  const price = coming && (body.price === "take" || body.price === "send" || body.price === "later") ? body.price : null;

  // The price is known: the invoice is made first, so the summary they get carries its link.
  let invoice: { id: string; amount: string; request: PaymentRequest } | null = null;
  if (price === "take" || price === "send") {
    const visit = await getAppointment(id);
    if (!visit?.customerId) return { ok: false, error: "There's no customer on this job to invoice." };
    const note = text(body.returnNote, 300).trim().replace(/\.$/, "");
    if (!note) return { ok: false, error: "Say what you're coming back for, e.g. fit the new diverter valve." };
    const pence = Math.round(Number(text(body.pricePounds, 20).replace(/[£,\s]/g, "")) * 100);
    if (!Number.isFinite(pence) || pence < 100) return { ok: false, error: "Enter the price for the return visit, e.g. 180." };
    // The call-out they've paid comes off, as the site says; one still unpaid is dropped instead (createPaymentRequest).
    const credit = await calloutCreditFor(visit);
    const created = await createPaymentRequest({
      staffId,
      customerId: visit.customerId,
      appointmentId: visit.id,
      kind: "invoice",
      description: `Return visit: ${note}`,
      lines: [{ description: note.charAt(0).toUpperCase() + note.slice(1), amountPence: pence }, ...(credit ? [{ description: "Call-out fee already paid", amountPence: -credit }] : [])],
      // Sent with the summary below; on its own if there's no summary.
      send: false,
    });
    if (!created.ok) return created.error === "Check the amounts." ? { ok: false, error: "Check the price: it needs to be more than the call-out they've paid." } : created;
    invoice = { id: created.request.id, amount: formatPence(created.request.amountPence), request: created.request };
  }

  const result = await completeJob({
    appointmentId: id,
    staffId,
    report: text(body.report, 4000),
    privateNote: text(body.privateNote, 4000),
    boiler: {
      boilerMake: text(body.boiler?.boilerMake, 120),
      boilerModel: text(body.boiler?.boilerModel, 120),
      boilerAge: text(body.boiler?.boilerAge, 120),
      boilerLocation: text(body.boiler?.boilerLocation, 120),
    },
    servicedToday: body.servicedToday === true,
    sendSummary: body.sendSummary === true,
    askReview: body.askReview === true,
    outcome: body.outcome === "return" ? "return" : "fixed",
    returnNote: text(body.returnNote, 300),
    ...(price ? { priceNeeded: price === "later" } : {}),
  });
  if (!result.ok) {
    // Not saved: the invoice goes too, so trying again doesn't make a second.
    if (invoice) await cancelPaymentRequest(invoice.id);
    return result;
  }
  // Sent with the summary; on its own if there wasn't one.
  const invoiceVia = invoice && price === "send" ? (body.sendSummary === true ? result.sentVia : await resendPaymentLink(invoice.id, staffId)) : [];
  const sent = reachedThem(result.sentVia) ? ` Summary sent by ${viaPhrase(result.sentVia)}.` : "";
  // Only phoned us, so no email or app: the invoice goes from WhatsApp Business instead.
  if (invoice && price === "send" && !reachedThem(invoiceVia)) {
    const visit = await getAppointment(id);
    const customer = visit?.customerId ? await getCustomer(visit.customerId) : null;
    const note = text(body.returnNote, 300).trim().replace(/\.$/, "");
    return {
      ok: true,
      message: `Saved: you're coming back. ${customer ? notReachedLine(customer).replace(/^Saved, but it/, "The invoice") : "The invoice hasn't reached them."}`,
      invoiceId: invoice.id,
      whatsapp: customer ? whatsappHandoff(customer, `Thanks for having us today. We'll be back to ${note}. Here's the invoice for it, ${invoice.amount}, to pay before then`, payLink(invoice.request)) : null,
    };
  }
  if (!coming) return { ok: true, message: `Job done.${sent}` };
  const next =
    price === "take" && invoice
      ? ` Take the ${invoice.amount} now.`
      : price === "send" && invoice
        ? ` Invoice for ${invoice.amount} sent.`
        : price === "later"
          ? " Send the price once you know it: it's on your list, with a reminder at 9am and 1pm."
          : "";
  return { ok: true, message: `Saved: you're coming back.${sent}${next}`, ...(invoice ? { invoiceId: invoice.id } : {}) };
}
