// Transactional email templates — plain functions producing subject +
// email-safe HTML (inline styles only, no Tailwind classes: email clients
// don't load stylesheets). Not wired to a sender yet — see the
// TODO(resend) in the admin callout flow. Structure/style is modelled on
// a reference "verify your login" email the client shared (logo, title,
// intro, a grey details box, a dark CTA button, a soft reassurance
// callout, and a plain-text footer with a few links), reskinned in MPE's
// own colours rather than copied verbatim.

import { business } from "./content";
import { SITE_URL } from "./seo";

const COLORS = {
  cream: "#f7f5f2",
  navy: "#1f2a3a",
  navyMuted: "#5b6472",
  terracotta: "#e8623a",
  terracottaLight: "#fbe4db",
  line: "#e4e0d9",
  grey: "#f7f7f7",
};

type DetailRow = { label: string; value: string };

function detailsTable(rows: DetailRow[]): string {
  const cells = rows
    .map(
      (row, i) => `
      <tr>
        <td style="padding: 14px 20px; border-top: ${i === 0 ? "none" : `1px solid ${COLORS.line}`}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${COLORS.navyMuted};">
          ${row.label}
        </td>
        <td style="padding: 14px 20px; border-top: ${i === 0 ? "none" : `1px solid ${COLORS.line}`}; font-size: 15px; font-weight: 700; color: ${COLORS.navy}; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
          ${row.value}
        </td>
      </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.grey}; border-radius: 14px; overflow: hidden; margin: 24px 0;">
      ${cells}
    </table>`;
}

function emailShell({
  eyebrow,
  title,
  intro,
  detailRows,
  ctaLabel,
  ctaHref,
  calloutText,
  footerNote,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  detailRows?: DetailRow[];
  ctaLabel?: string;
  ctaHref?: string;
  calloutText?: string;
  footerNote: string;
}): string {
  const cta =
    ctaLabel && ctaHref
      ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 0;">
                  <tr>
                    <td>
                      <a href="${ctaHref}" style="display: block; width: 100%; box-sizing: border-box; padding: 16px 24px; background: ${COLORS.navy}; color: #ffffff; text-align: center; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 999px;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>`
      : "";

  const callout = calloutText
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 0; background: ${COLORS.terracottaLight}; border-radius: 14px;">
                  <tr>
                    <td style="padding: 16px 18px; font-size: 13px; line-height: 1.55; color: #8a3d1f;">
                      ${calloutText}
                    </td>
                  </tr>
                </table>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin: 0; padding: 0; background: ${COLORS.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.cream}; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 20px; padding: 40px; box-shadow: 0 20px 45px -25px rgba(31,42,58,0.3);">
            <tr>
              <td>
                <img src="${SITE_URL}/mpe-logo.png" alt="${business.fullName}" height="36" style="height: 36px; width: auto; display: block; margin-bottom: 28px;" />

                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.terracotta};">
                  ${eyebrow}
                </p>
                <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; line-height: 1.25; color: ${COLORS.navy};">
                  ${title}
                </h1>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${COLORS.navyMuted};">
                  ${intro}
                </p>

                ${detailRows ? detailsTable(detailRows) : ""}
                ${cta}
                ${callout}
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin-top: 24px;">
            <tr>
              <td align="center" style="font-size: 12px; line-height: 1.7; color: ${COLORS.navyMuted};">
                ${footerNote}<br />
                <a href="${SITE_URL}/privacy" style="color: ${COLORS.navyMuted}; text-decoration: underline;">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/contact" style="color: ${COLORS.navyMuted}; text-decoration: underline;">Help Centre</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Sent when Fergal hits "Confirm callout" in /admin/callouts: the agreed
// date/time window, plus the £50 confirm-and-save-card payment link.
// paymentLink will be a real Stripe Checkout/SetupIntent URL once Stripe
// is wired up — see TODO(stripe) in CalloutsAdmin.tsx.
export function calloutConfirmationEmail({
  name,
  calloutDate,
  timeWindow,
  paymentLink,
}: {
  name: string;
  calloutDate: string;
  timeWindow: string;
  paymentLink: string;
}): { subject: string; html: string } {
  const firstName = name.trim().split(" ")[0] || name;

  return {
    subject: `Your callout is booked in — confirm with £50 to lock it in`,
    html: emailShell({
      eyebrow: "Callout confirmed",
      title: `You're booked in, ${firstName}`,
      intro:
        "We've agreed a time for your engineer to visit. Confirm below to lock in the slot — this also saves a card on file so there's nothing to sort on the day.",
      detailRows: [
        { label: "Date", value: calloutDate },
        { label: "Time window", value: timeWindow },
        { label: "Call-out fee", value: "£50" },
      ],
      ctaLabel: "Confirm & pay £50",
      ctaHref: paymentLink,
      calloutText:
        "This £50 is fully deducted from your final invoice once the job's done — you're never charged the call-out and the full price. You only end up paying the £50 on its own if you decide not to proceed after the diagnosis.",
      footerNote: `You're receiving this because you booked a callout with ${business.fullName}.`,
    }),
  };
}

// Sent when Fergal changes an already-confirmed callout's date/time —
// same shape as the confirmation email, minus the payment step (the £50
// is already paid and the card already on file, so there's nothing left
// to confirm — this is purely informational).
export function calloutRescheduledEmail({
  name,
  calloutDate,
  timeWindow,
}: {
  name: string;
  calloutDate: string;
  timeWindow: string;
}): { subject: string; html: string } {
  const firstName = name.trim().split(" ")[0] || name;

  return {
    subject: `Your callout has been rescheduled`,
    html: emailShell({
      eyebrow: "Callout rescheduled",
      title: `New time, ${firstName}`,
      intro: "Your engineer's visit has moved — here's the new date and time window.",
      detailRows: [
        { label: "Date", value: calloutDate },
        { label: "Time window", value: timeWindow },
      ],
      footerNote: `You're receiving this because you have a callout booked with ${business.fullName}.`,
    }),
  };
}

// Sent when Fergal replies to a "just a question" message from
// /admin/callouts (the "Reply & close" action) — the plainest of these
// templates, since it's a direct reply rather than a system notification.
export function replyEmail({
  name,
  message,
}: {
  name: string;
  message: string;
}): { subject: string; html: string } {
  const firstName = name.trim().split(" ")[0] || name;

  return {
    subject: `Re: your message to ${business.fullName}`,
    html: emailShell({
      eyebrow: "Reply from " + business.fullName,
      title: `Hi ${firstName},`,
      intro: message,
      footerNote: `You're receiving this because you messaged ${business.fullName}.`,
    }),
  };
}

// Sent when Fergal marks a job complete and chooses to email the final
// invoice rather than charge the card on file directly. paymentLink will
// be a real Stripe-hosted invoice URL once Stripe is wired up.
export function invoiceEmail({
  name,
  amountPence,
  jobSummary,
  paymentLink,
}: {
  name: string;
  amountPence: number;
  jobSummary: string;
  paymentLink: string;
}): { subject: string; html: string } {
  const firstName = name.trim().split(" ")[0] || name;
  const amount = (amountPence / 100).toFixed(2);

  return {
    subject: `Your invoice from ${business.fullName} — £${amount}`,
    html: emailShell({
      eyebrow: "Invoice",
      title: `Your invoice, ${firstName}`,
      intro: jobSummary,
      detailRows: [{ label: "Amount due", value: `£${amount}` }],
      ctaLabel: `Pay £${amount}`,
      ctaHref: paymentLink,
      calloutText:
        "This covers the work carried out on your visit. If anything doesn't look right, just reply to this email or give us a call.",
      footerNote: `You're receiving this because you're a customer of ${business.fullName}.`,
    }),
  };
}
