import { renderEmailLayout } from "./layout";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { noticeHeadline, requestedWhen, type NoticeType, type VisitFacts } from "@/lib/visit-copy";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';
const LABEL = 'style="padding:6px 16px 6px 0;font-size:14px;color:#5b6573;vertical-align:top;white-space:nowrap"';
const VALUE = 'style="padding:6px 0;font-size:15px;font-weight:600;color:#1f2a3a"';

/**
 * A visit email: booked, moved, cancelled, tomorrow's reminder, or a request
 * received. The details as a small table, then the customer's page for the
 * visit (calendar, ask for another time) and a call button.
 */
export function visitEmailHtml(params: {
  type: NoticeType;
  visit: VisitFacts;
  name: string | null;
  link: string;
  phone: string;
  phoneHref: string;
  canReplyByEmail: boolean;
  /** The service booking form, for "your service is due". */
  bookLink?: string;
  /** Who's coming, for the hour-before message. */
  engineer?: string | null;
  /** A call-out they can pay ahead (lib/callout-prepay.ts): the email's button. */
  payLink?: string | null;
}): string {
  const { type, visit, link, phone, phoneHref } = params;
  const hi = params.name ? `Hi ${escapeHtml(params.name.split(" ")[0])},` : "Hi,";
  const where = [visit.address, visit.postcode].filter(Boolean).join(", ");
  const when =
    type === "requested"
      ? requestedWhen(visit.day, visit.part)
      : type === "past_request"
        ? requestedWhen(visit.day, visit.part)
      : type === "cancelled" || type === "missed" || type === "service_due"
        ? longDate(visit.day)
        : `${longDate(visit.day)}, between ${windowLabel(visit.start, visit.end).replace("–", " and ")}`;

  const intro: Record<NoticeType, string> = {
    booked: `You're booked in. Here are the details.${params.engineer ? ` Your MPE engineer will be ${escapeHtml(params.engineer)}.` : ""}${visit.calloutFee && visit.kind === "callout" ? ` The call-out is ${escapeHtml(visit.calloutFee)}, taken off your repair bill if you go ahead.` : visit.planFree && visit.kind === "callout" ? " Your call-out's free with your MPE maintenance plan." : ""}`,
    moved: "We've moved your visit. Here's the new time.",
    cancelled: "This visit is cancelled. If you'd still like one, just reply or give us a call.",
    reminder: "A reminder that we're with you tomorrow.",
    requested: `Thanks, we've got your request. We'll be in touch to confirm the time.${visit.kind === "callout" || visit.kind === "repair" ? ` If it's urgent, call us on ${escapeHtml(phone)}.` : ""}`,
    hour: `Just confirming ${params.engineer ? `your MPE engineer, ${escapeHtml(params.engineer)},` : "your MPE engineer"} will be with you today between ${windowLabel(visit.start, visit.end).replace("–", " and ")}.`,
    late: `Sorry, we're running behind today. ${params.engineer ? `Your MPE engineer, ${escapeHtml(params.engineer)},` : "Your MPE engineer"} will now be with you between ${windowLabel(visit.start, visit.end).replace("–", " and ")}.`,
    missed: "We called round but couldn't get in. No problem: pick another time that suits and we'll confirm it.",
    past_request: "Sorry, we didn't get to your request on the day you asked for. Pick another day that suits and we'll confirm it.",
    service_due: `It's nearly a year since your boiler ${visit.kind === "install" ? "was fitted" : "was last serviced"}, so its annual service is due. A yearly service keeps it safe and its warranty valid.`,
  };
  const after =
    type === "cancelled" || type === "requested" || type === "missed" || type === "past_request" || type === "service_due"
      ? ""
      : type === "hour" || type === "late"
        ? `<p ${P}>If you won't be in, let us know on the page below${params.canReplyByEmail ? ", by replying to this email," : ""} or by calling ${escapeHtml(phone)}.</p>`
      : `<p ${P}>If you can't make it, let us know${params.canReplyByEmail ? " by replying to this email," : ""} on the page below or by calling ${escapeHtml(phone)}.</p>`;

  const prepay = type === "booked" && !!params.payLink;
  const bodyHtml = `<p ${P}>${hi}</p>
<p ${P}>${intro[type]}</p>
${prepay ? `<p ${P}>You can pay the call-out now from your phone, by Apple Pay, Google Pay or card. Or pay ${params.engineer ? escapeHtml(params.engineer) : "your engineer"} on the day.</p>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">
<tr><td ${LABEL}>Visit</td><td ${VALUE}>${escapeHtml(visit.returning ? "Return visit" : KIND_LABEL[visit.kind])}</td></tr>
<tr><td ${LABEL}>${type === "requested" || type === "past_request" ? "You asked for" : type === "service_due" ? "Last visit" : type === "missed" ? "Booked for" : "When"}</td><td ${VALUE}>${escapeHtml(when)}</td></tr>
${where ? `<tr><td ${LABEL}>Where</td><td ${VALUE}>${escapeHtml(where)}</td></tr>` : ""}
</table>
${after}`;

  return renderEmailLayout({
    previewText: `${noticeHeadline(type, visit)}: ${when}`,
    heading: noticeHeadline(type, visit),
    bodyHtml,
    ctaLabel: prepay ? `Pay the ${visit.calloutFee} call-out now` : type === "cancelled" ? undefined : type === "missed" || type === "past_request" ? "Pick another time" : type === "service_due" ? "Book your service" : "See your visit",
    ctaUrl: prepay ? (params.payLink ?? link) : type === "cancelled" ? undefined : type === "service_due" ? (params.bookLink ?? link) : link,
    secondaryCtaLabel: prepay ? "See your visit" : `Call ${phone}`,
    secondaryCtaUrl: prepay ? link : phoneHref,
  });
}
