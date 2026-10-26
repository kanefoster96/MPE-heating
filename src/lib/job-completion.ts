import { createAdminClient } from "@/lib/supabase/admin";
import { categoriesFor, getAppointment, visitChain, type Appointment } from "@/lib/appointments";
import { addCustomerNote, getCustomer, updateCustomer, type CustomerFields } from "@/lib/customers";
import { deliverToCustomer, postCustomerVisitMessage, visitLink } from "@/lib/visit-notify";
import { calloutAskedFor, calloutCreditFor, formatPence, invoiceNumber, payLink, paymentsForAppointments } from "@/lib/payments";
import { renderEmailLayout } from "@/lib/emails/layout";
import { business } from "@/lib/content";
import { KIND_LABEL, longDate } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { recordPlanService } from "@/lib/maintenance-plan";

/**
 * Finishing a job. Fergal says what he did (the customer sees it on their
 * visit page and account), can update the boiler details and leave the team
 * a private note for next time, and the customer gets a summary with their
 * invoice or receipt. A couple of hours later they're asked how it went
 * (the follow-up sweep), with one reminder.
 *
 * Not fixed first time (a part to order): finished as "coming back", with
 * what for. They're told what was found and that we'll be back, there's no
 * review ask until it's fixed, and the team are reminded to book the return
 * visit (lib/app-notifications.ts). The return visit points back to it.
 *
 * Reviews: their stars and words go to MPE, and everyone is invited to post
 * a public review too, whatever they gave: inviting only the happy ones is
 * review gating, which Google's rules and UK consumer law don't allow.
 */

/** How long after the job the review ask goes: long enough for the radiators to warm up. */
export const REVIEW_ASK_AFTER_HOURS = 2;
/** One reminder, this long after the ask, if they haven't answered. */
export const REVIEW_REMIND_AFTER_DAYS = 3;
/** Someone who reviewed recently isn't asked again for this long. */
const REVIEW_QUIET_DAYS = 180;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type JobReview = { rating: number; comment: string | null; publicClickedAt: string | null; createdAt: string };

/** "today", "yesterday", or "on Monday 26 October". */
function whenDone(day: string): string {
  const today = londonNow().dateISO;
  if (day === today) return "today";
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().slice(0, 10)) return "yesterday";
  return `on ${longDate(day)}`;
}

/** The invoice or receipt for the visit, as a line in the summary. */
async function paymentLine(appointmentId: string): Promise<{ text: string; href: string } | null> {
  const payments = ((await paymentsForAppointments([appointmentId])).get(appointmentId) ?? []).filter((p) => p.status !== "cancelled");
  const open = payments.find((p) => p.status === "open");
  if (open) {
    return {
      text: `Your ${open.kind === "callout_fee" ? "call-out fee" : `invoice ${invoiceNumber(open.number)}`} (${formatPence(open.amountPence)}) is here: ${payLink(open)}`,
      href: payLink(open),
    };
  }
  const paid = [...payments].reverse().find((p) => p.status === "paid");
  return paid ? { text: `Your receipt: ${payLink(paid)}`, href: payLink(paid) } : null;
}

export async function completeJob(params: {
  appointmentId: string;
  staffId: string;
  report: string;
  privateNote?: string;
  boiler?: Partial<Pick<CustomerFields, "boilerMake" | "boilerModel" | "boilerAge" | "boilerLocation">>;
  servicedToday?: boolean;
  sendSummary: boolean;
  askReview: boolean;
  /** "return": not fixed yet, coming back (a part to fit); `returnNote` says what for. */
  outcome?: "fixed" | "return";
  returnNote?: string;
}): Promise<{ ok: true; sentVia: string[] } | { ok: false; error: string }> {
  const visit = await getAppointment(params.appointmentId);
  if (!visit) return { ok: false, error: "That visit's gone." };
  const report = params.report.trim().slice(0, 2000);
  const coming = params.outcome === "return";
  // Kept as the end of a sentence ("coming back to fit the new valve"), so a capital's dropped unless it's a name like "MPE".
  const typed = coming ? (params.returnNote ?? "").trim().replace(/\.$/, "").slice(0, 300) : "";
  const returnNote = /^[A-Z][a-z]/.test(typed) ? lowerFirst(typed) : typed;
  if (coming && !returnNote) return { ok: false, error: "Say what you're coming back for, e.g. fit the new diverter valve." };
  const now = new Date();
  const admin = createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({
      status: "done",
      job_report: report || null,
      completed_at: now.toISOString(),
      completed_by: params.staffId,
      review_due_at: params.askReview && !coming && visit.customerId ? new Date(now.getTime() + REVIEW_ASK_AFTER_HOURS * 3_600_000).toISOString() : null,
      outcome: coming ? "return" : "fixed",
      return_note: returnNote || null,
      change_day: null,
      change_part: null,
      change_note: null,
      change_requested_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", visit.id);
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };

  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  if (!customer) return { ok: true, sentVia: [] };

  if (params.privateNote?.trim()) await addCustomerNote(customer.id, params.privateNote, params.staffId);
  // Fixed: their booking (and the first visit's, for a return visit) is done.
  if (!coming) await closeEnquiries(visit, params.staffId);

  // Boiler details, only the ones filled in; a service today updates "last serviced".
  const fields: Partial<CustomerFields> = {};
  for (const [key, value] of Object.entries(params.boiler ?? {}) as [keyof CustomerFields, string | undefined][]) {
    if (value && value.trim()) fields[key] = value.trim().slice(0, 120);
  }
  if (params.servicedToday) {
    const [y, m] = visit.day.split("-").map(Number);
    fields.lastService = `${MONTHS[m - 1]} ${y}`;
  }
  if (Object.keys(fields).length) await updateCustomer(customer.id, fields);
  // On the plan: their free yearly service is done, for the team's record.
  if (params.servicedToday) await recordPlanService(customer.id, visit.day);

  if (!params.sendSummary) return { ok: true, sentVia: [] };
  const first = customer.name ? customer.name.split(" ")[0] : null;
  const pay = await paymentLine(visit.id);
  // The call-out they paid comes off the repair, as the site says, however many visits it takes.
  const credit = coming ? await calloutCreditFor(visit) : 0;
  const feeOpen = coming && !credit && (await calloutAskedFor(visit));
  // Unpaid: it's due now (the site's "£50 on the day"), and comes off the bill later, said once, after the link.
  const creditLine = credit ? ` The ${formatPence(credit)} call-out you paid comes off the final bill.` : feeOpen ? " Your call-out fee comes off the final bill." : "";
  const next = coming ? ` We'll be back to finish the job: ${lowerFirst(returnNote)}. We'll be in touch to book a time, or reply with a day that suits.${feeOpen ? "" : creditLine}` : "";
  const payText = pay ? ` ${pay.text}${feeOpen ? creditLine : ""}` : "";
  const what = visitWord(visit);
  const body = coming
    ? `${first ? `Hi ${first}, ` : "Hi, "}thanks for having us ${whenDone(visit.day)}.${report ? ` Here's what we found: ${endSentence(report)}` : ""}${next}${payText}`
    : `${first ? `Hi ${first}, ` : "Hi, "}thanks for having us ${whenDone(visit.day)}.${report ? ` Here's what we did: ${endSentence(report)}` : ""}${pay ? ` ${pay.text}` : ""} Any questions, just reply.`;
  const sentVia = await deliverToCustomer(customer, {
    body,
    headline: coming ? `Your ${what}: what we found, and what's next` : `Your ${what}: what we did`,
    staffId: params.staffId,
    pushHref: `/visit/${visit.publicToken}`,
    emailHtml: () => jobSummaryEmailHtml({ name: first, visit, report, pay, link: visitLink(visit), returnNote: coming ? returnNote : null, creditLine }),
  });
  return { ok: true, sentVia };
}

/** "call-out", or "return visit" for the visit that came back to finish a job. */
function visitWord(visit: Appointment): string {
  return visit.followUpOf ? "return visit" : KIND_LABEL[visit.kind].toLowerCase();
}

/** So the next sentence doesn't run on from the report. */
function endSentence(text: string): string {
  return /[.!?)]$/.test(text) ? text : `${text}.`;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** A fixed job's bookings are done: the ones its visits came from, and any still open in their conversation. */
async function closeEnquiries(visit: Appointment, staffId: string): Promise<void> {
  const admin = createAdminClient();
  const chain = await visitChain(visit);
  const ids = chain.map((v) => v.enquiryId).filter((x): x is string => !!x);
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const update = { status: "done", updated_at: new Date().toISOString(), updated_by: staffId };
  if (ids.length) await admin.from("enquiries").update(update).in("id", ids).in("status", ["new", "contacted", "booked"]);
  if (customer?.conversationId) await admin.from("enquiries").update(update).eq("conversation_id", customer.conversationId).in("category", categoriesFor(chain[0].kind)).eq("status", "booked");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';

function jobSummaryEmailHtml(params: { name: string | null; visit: Appointment; report: string; pay: { text: string; href: string } | null; link: string; returnNote: string | null; creditLine?: string }): string {
  const { visit, report, pay, returnNote, creditLine } = params;
  const box = 'style="margin:0 0 20px;padding:12px 16px;border-radius:12px;background:#f7f5f2;font-size:15px;line-height:1.55;color:#1f2a3a;white-space:pre-wrap"';
  const label = 'style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1f2a3a"';
  const bodyHtml = `<p ${P}>${params.name ? `Hi ${escapeHtml(params.name)},` : "Hi,"}</p>
<p ${P}>Thanks for having us ${whenDone(visit.day)}.</p>
${report ? `<p ${label}>${returnNote ? "What we found" : "What we did"}</p><p ${box}>${escapeHtml(report)}</p>` : ""}
${returnNote ? `<p ${label}>What's next</p><p ${box}>We'll be back to finish the job: ${escapeHtml(lowerFirst(returnNote))}. We'll be in touch to book a time, or reply with a day that suits.${creditLine ? escapeHtml(creditLine) : ""}</p>` : ""}
<p ${P}>Any questions, just reply or call ${escapeHtml(business.phoneDisplay)}.</p>`;
  return renderEmailLayout({
    previewText: returnNote ? "What we found, and what's next" : report ? `What we did: ${report.slice(0, 90)}` : "Thanks for having us",
    heading: returnNote ? `Your ${visitWord(visit)}: what we found, and what's next` : `Your ${visitWord(visit)}: what we did`,
    bodyHtml,
    ctaLabel: pay ? (pay.text.startsWith("Your receipt") ? "View receipt" : "View and pay") : "See your visit",
    ctaUrl: pay?.href ?? params.link,
    secondaryCtaLabel: `Call ${business.phoneDisplay}`,
    secondaryCtaUrl: business.phoneHref,
  });
}

// ---------------------------------------------------------------------------
// Reviews.

export function reviewLink(visit: Pick<Appointment, "publicToken">): string {
  return `${visitLink(visit)}/review`;
}

export async function getJobReview(appointmentId: string): Promise<JobReview | null> {
  const { data } = await createAdminClient()
    .from("job_reviews")
    .select("rating, comment, public_clicked_at, created_at")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  return data
    ? { rating: data.rating as number, comment: (data.comment as string | null) ?? null, publicClickedAt: (data.public_clicked_at as string | null) ?? null, createdAt: data.created_at as string }
    : null;
}

export async function reviewsForCustomer(customerId: string): Promise<(JobReview & { appointmentId: string })[]> {
  const { data } = await createAdminClient()
    .from("job_reviews")
    .select("appointment_id, rating, comment, public_clicked_at, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    appointmentId: r.appointment_id as string,
    rating: r.rating as number,
    comment: (r.comment as string | null) ?? null,
    publicClickedAt: (r.public_clicked_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Their stars and words: saved for MPE, and in their conversation so the team sees it (and gets a push). */
export async function saveJobReview(visit: Appointment, rating: number, comment: string | null): Promise<boolean> {
  if (!visit.customerId || !Number.isInteger(rating) || rating < 1 || rating > 5) return false;
  const text = comment?.trim().slice(0, 2000) || null;
  const { error } = await createAdminClient()
    .from("job_reviews")
    .upsert({ appointment_id: visit.id, customer_id: visit.customerId, rating, comment: text }, { onConflict: "appointment_id" });
  if (error) return false;
  const customer = await getCustomer(visit.customerId);
  if (customer) {
    await postCustomerVisitMessage(
      customer,
      `Review of my ${KIND_LABEL[visit.kind].toLowerCase()} on ${longDate(visit.day)}: ${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)${text ? `\n"${text}"` : ""}`,
    );
  }
  return true;
}

export async function markPublicReviewClicked(appointmentId: string): Promise<void> {
  await createAdminClient().from("job_reviews").update({ public_clicked_at: new Date().toISOString() }).eq("appointment_id", appointmentId).is("public_clicked_at", null);
}

/** The ask (stage 1), or the one reminder (stage 2). False when it wasn't sent (already reviewed, or reviewed recently). */
export async function sendReviewAsk(appointmentId: string, stage: 1 | 2): Promise<boolean> {
  const visit = await getAppointment(appointmentId);
  // Only once it's fixed: never while they're waiting for the return visit.
  if (!visit?.customerId || visit.status !== "done" || visit.outcome === "return") return false;
  if (await getJobReview(visit.id)) return false;
  const since = new Date(Date.now() - REVIEW_QUIET_DAYS * 86_400_000).toISOString();
  const { count } = await createAdminClient()
    .from("job_reviews")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", visit.customerId)
    .gte("created_at", since);
  if (count) return false;
  const customer = await getCustomer(visit.customerId);
  if (!customer) return false;
  const first = customer.name ? customer.name.split(" ")[0] : null;
  const link = reviewLink(visit);
  const body =
    stage === 1
      ? `${first ? `Hi ${first}, ` : "Hi, "}thanks for having us ${whenDone(visit.day)}. How did we do? It takes 30 seconds: ${link}`
      : `${first ? `Hi ${first}, ` : "Hi, "}if you have a moment, we'd love to know how your ${visitWord(visit)} went: ${link}`;
  const via = await deliverToCustomer(customer, {
    body,
    headline: "How did we do?",
    staffId: null,
    pushHref: `/visit/${visit.publicToken}/review`,
    smsOptOut: true,
    emailHtml: () =>
      renderEmailLayout({
        previewText: "How did we do? It takes 30 seconds.",
        heading: "How did we do?",
        bodyHtml: `<p ${P}>${first ? `Hi ${escapeHtml(first)},` : "Hi,"}</p><p ${P}>Thanks for having us ${whenDone(visit.day)}. We'd love to know how it went. It takes 30 seconds.</p>`,
        ctaLabel: "Rate your visit",
        ctaUrl: link,
      }),
  });
  return via.length > 0;
}
