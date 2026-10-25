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
}): string {
  const { type, visit, link, phone, phoneHref } = params;
  const hi = params.name ? `Hi ${escapeHtml(params.name.split(" ")[0])},` : "Hi,";
  const where = [visit.address, visit.postcode].filter(Boolean).join(", ");
  const when =
    type === "requested"
      ? requestedWhen(visit.day, visit.part)
      : type === "cancelled"
        ? longDate(visit.day)
        : `${longDate(visit.day)}, between ${windowLabel(visit.start, visit.end).replace("–", " and ")}`;

  const intro: Record<NoticeType, string> = {
    booked: "You're booked in. Here are the details.",
    moved: "We've moved your visit. Here's the new time.",
    cancelled: "This visit is cancelled. If you'd still like one, just reply or give us a call.",
    reminder: "A reminder that we're with you tomorrow.",
    requested: "Thanks, we've got your request. We'll be in touch to confirm the time.",
  };
  const after =
    type === "cancelled" || type === "requested"
      ? ""
      : `<p ${P}>If you can't make it, let us know${params.canReplyByEmail ? " by replying to this email," : ""} on the page below or by calling ${escapeHtml(phone)}.</p>`;

  const bodyHtml = `<p ${P}>${hi}</p>
<p ${P}>${intro[type]}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">
<tr><td ${LABEL}>Visit</td><td ${VALUE}>${escapeHtml(KIND_LABEL[visit.kind])}</td></tr>
<tr><td ${LABEL}>${type === "requested" ? "You asked for" : "When"}</td><td ${VALUE}>${escapeHtml(when)}</td></tr>
${where ? `<tr><td ${LABEL}>Where</td><td ${VALUE}>${escapeHtml(where)}</td></tr>` : ""}
</table>
${after}`;

  return renderEmailLayout({
    previewText: `${noticeHeadline(type, visit)}: ${when}`,
    heading: noticeHeadline(type, visit),
    bodyHtml,
    ctaLabel: type === "cancelled" ? undefined : "See your visit",
    ctaUrl: type === "cancelled" ? undefined : link,
    secondaryCtaLabel: `Call ${phone}`,
    secondaryCtaUrl: phoneHref,
  });
}
