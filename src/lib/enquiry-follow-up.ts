import { renderEmailLayout } from "@/lib/emails/layout";
import { CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { issueLine, type Enquiry, type EnquiryCategory } from "@/lib/enquiries";

/**
 * Following up a booking form that hasn't turned into a visit: Kanvas
 * Academy's trial follow-ups for MPE. It reminds them what they asked about
 * (in their own words), and gives them their link to pick a day and time,
 * which goes on the team's schedule as a request. Two at most: a day later,
 * then one last check-in that says we won't message again.
 */

const ABOUT: Record<EnquiryCategory, string> = {
  callout: "your boiler",
  new_boiler: "a new boiler",
  service: "your boiler service",
  plan: "a maintenance plan",
  commercial: "your job",
  other: "your enquiry",
};

export function requestLink(e: Pick<Enquiry, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/request/${e.publicToken}`;
}

export function followUpBody(e: Enquiry, stage: 1 | 2, name: string | null): string {
  const hi = name ? `Hi ${name.split(" ")[0]}, ` : "Hi, ";
  const issue = issueLine(e);
  const about = `${ABOUT[e.category]}${issue ? ` (${issue})` : ""}`;
  const link = requestLink(e);
  return stage === 1
    ? `${hi}you asked us about ${about}. Still need a hand? Pick a day and time that suits and we'll confirm it: ${link}`
    : `${hi}just checking in about ${about}. If you'd still like us to help, pick a time here: ${link} If it's sorted, no need to reply and we won't message about it again.`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';

function followUpEmailHtml(e: Enquiry, stage: 1 | 2, name: string | null): string {
  const issue = issueLine(e, 200);
  const heading = stage === 1 ? `Still need a hand with ${ABOUT[e.category]}?` : "Just checking in";
  const bodyHtml = `<p ${P}>${name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,"}</p>
<p ${P}>You asked us about ${escapeHtml(ABOUT[e.category])}${issue ? `:` : "."}</p>
${issue ? `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#f7f5f2;font-size:15px;color:#1f2a3a">${escapeHtml(issue)}</p>` : ""}
<p ${P}>${stage === 1 ? "Pick a day and a time of day that suits you, and we'll confirm it." : "If you'd still like us to help, pick a time below. If it's sorted, no need to reply and we won't email about it again."}</p>`;
  return renderEmailLayout({
    previewText: heading,
    heading,
    bodyHtml,
    ctaLabel: "Pick a time",
    ctaUrl: requestLink(e),
    secondaryCtaLabel: `Call ${business.phoneDisplay}`,
    secondaryCtaUrl: business.phoneHref,
  });
}

/** Sends follow-up `stage` for a booking form; returns how it went. */
export async function sendEnquiryFollowUp(e: Enquiry, stage: 1 | 2): Promise<string[]> {
  if (!e.customerId) return [];
  const customer = await getCustomer(e.customerId);
  if (!customer) return [];
  return deliverToCustomer(customer, {
    body: followUpBody(e, stage, customer.name),
    headline: stage === 1 ? `Still need a hand with ${ABOUT[e.category]}?` : "Just checking in",
    staffId: null,
    pushHref: `/request/${e.publicToken}`,
    smsOptOut: true,
    emailHtml: () => followUpEmailHtml(e, stage, customer.name),
  });
}
