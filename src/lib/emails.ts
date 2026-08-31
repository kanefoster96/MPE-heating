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
  ctaLabel: string;
  ctaHref: string;
  calloutText: string;
  footerNote: string;
}): string {
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

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 0;">
                  <tr>
                    <td>
                      <a href="${ctaHref}" style="display: block; width: 100%; box-sizing: border-box; padding: 16px 24px; background: ${COLORS.navy}; color: #ffffff; text-align: center; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 999px;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 0; background: ${COLORS.terracottaLight}; border-radius: 14px;">
                  <tr>
                    <td style="padding: 16px 18px; font-size: 13px; line-height: 1.55; color: #8a3d1f;">
                      ${calloutText}
                    </td>
                  </tr>
                </table>
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
