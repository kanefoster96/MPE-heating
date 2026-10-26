import { getAppointment } from "@/lib/appointments";
import { customerLabel, getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { completeJob, getJobReview } from "@/lib/job-completion";
import { CERT_LABEL, CERT_TYPES, fileLabel, filesForCustomer } from "@/lib/job-files";
import { formatPence, invoiceNumber, paymentsForAppointments } from "@/lib/payments";
import { londonNow } from "@/lib/schedule-time";
import { viaPhrase } from "@/lib/visit-notify";

/**
 * Finishing a job in the app (mobile/app/finish/[id].tsx): the website's
 * /staff/jobs/[id]/finish. What was done (the customer sees it), their
 * boiler, a private note for next time, the summary and the review ask,
 * and photos and certificates for the job. Saved by completeJob, as the
 * website does; opened again later, it edits what was saved.
 */

export async function finishDraft(id: string) {
  const visit = await getAppointment(id);
  if (!visit) return null;
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const [payments, review, files] = await Promise.all([
    paymentsForAppointments([visit.id]).then((m) => (m.get(visit.id) ?? []).filter((p) => p.status !== "cancelled")),
    getJobReview(visit.id),
    customer ? filesForCustomer(customer.id).catch(() => []) : Promise.resolve([]),
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
};

export async function finish(id: string, body: FinishBody, staffId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
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
  });
  if (!result.ok) return result;
  return { ok: true, message: `Job done.${result.sentVia.length ? ` Summary sent by ${viaPhrase(result.sentVia)}.` : ""}` };
}
