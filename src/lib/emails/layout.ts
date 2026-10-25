// Shared branded wrapper for every email MPE sends (ported from Kanvas
// Academy, recoloured to MPE's navy and orange). Built
// as plain inline-styled HTML (no React Email/JSX) to match the existing
// pattern in lib/trial.ts, and deliberately on a light background — dark
// email bodies render unreliably across clients (Outlook, Gmail's dark-mode
// color inversion, default image blocking), so the "on brand" translation of
// the site's black/white theme here is a light card with the ink color used
// for headings and the button, rather than a literal black background.

import { CLUB, CLUB_ADDRESS } from "@/lib/club";

const INK = "#1f2a3a";
const MUTED = "#5b6573";
const BORDER = "#ece8e3";
const PAPER = "#ffffff";
const PAGE_BG = "#f7f5f2";
// The site's button orange (white text on it is 5.6:1).
const ACCENT = "#b5411c";

export function renderEmailLayout({
  previewText,
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  secondaryCtaLabel,
  secondaryCtaUrl,
}: {
  /** Hidden preview text shown in inbox lists (e.g. Gmail's snippet line). */
  previewText: string;
  heading: string;
  /** Pre-built inline-styled HTML — callers own their own paragraph/list markup. */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** A quieter outlined button under the main one, for the "or…" answer. */
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${CLUB.name}</title>
  </head>
  <body style="margin:0; padding:0; background:${PAGE_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <span style="display:none; opacity:0; visibility:hidden; height:0; width:0; overflow:hidden; mso-hide:all;">${previewText}</span>
    <div style="max-width:480px; margin:0 auto; padding:40px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}; border:1px solid ${BORDER}; border-radius:16px; overflow:hidden;">
        <tr>
          <td style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid ${BORDER};">
            <p style="margin:0; font-size:20px; font-weight:700; letter-spacing:0.08em; color:${INK};">${CLUB.shortName.toUpperCase()}</p>
            <p style="margin:4px 0 0; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:${MUTED};">Gas, heating, plumbing &amp; electrics</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:${INK};">${heading}</h1>
            <div style="color:#333333; font-size:15px; line-height:1.6;">${bodyHtml}</div>
            ${
              ctaLabel && ctaUrl
                ? `<div style="margin-top:28px;"><a href="${ctaUrl}" style="display:inline-block; background:${ACCENT}; color:#ffffff; text-decoration:none; padding:12px 26px; border-radius:999px; font-size:14px; font-weight:600;">${ctaLabel}</a></div>`
                : ""
            }
            ${
              secondaryCtaLabel && secondaryCtaUrl
                ? `<div style="margin-top:12px;"><a href="${secondaryCtaUrl}" style="display:inline-block; background:${PAPER}; color:${INK}; text-decoration:none; padding:11px 25px; border:1px solid ${INK}; border-radius:999px; font-size:14px; font-weight:600;">${secondaryCtaLabel}</a></div>`
                : ""
            }
          </td>
        </tr>
      </table>
      <p style="text-align:center; margin:24px 0 0; font-size:12px; color:${MUTED};">
        ${CLUB.name} · ${CLUB_ADDRESS}
      </p>
    </div>
  </body>
</html>`;
}
