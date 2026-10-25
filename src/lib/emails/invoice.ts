import { renderEmailLayout } from "./layout";
import { business } from "@/lib/content";
import { formatPence, invoiceNumber, PAID_VIA_LABEL, type PaymentRequest } from "@/lib/payments";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';
const CELL = 'style="padding:8px 0;font-size:15px;color:#1f2a3a;border-bottom:1px solid #ece8e3"';
const AMOUNT = 'style="padding:8px 0 8px 16px;font-size:15px;color:#1f2a3a;border-bottom:1px solid #ece8e3;text-align:right;white-space:nowrap"';

/** A call-out fee or an invoice: its lines, the total, and Pay (or Paid). */
export function invoiceEmailHtml(params: { request: PaymentRequest; name: string | null; link: string }): string {
  const { request: r, link } = params;
  const hi = params.name ? `Hi ${escapeHtml(params.name.split(" ")[0])},` : "Hi,";
  const paid = r.status === "paid";
  const heading = r.kind === "callout_fee" ? "Your call-out fee" : `Invoice ${invoiceNumber(r.number)}`;
  const rows = r.lines
    .map((l) => `<tr><td ${CELL}>${escapeHtml(l.description)}</td><td ${AMOUNT}>${formatPence(l.amountPence)}</td></tr>`)
    .join("");
  const bodyHtml = `<p ${P}>${hi}</p>
<p ${P}>${
    paid
      ? `Thanks, this is paid${r.paidVia ? ` (${PAID_VIA_LABEL[r.paidVia]})` : ""}. Here's your receipt.`
      : r.kind === "callout_fee"
        ? "Here's your call-out fee. If you go ahead with the repair, it comes off your bill."
        : `Here's your invoice for ${escapeHtml(r.description.charAt(0).toLowerCase() + r.description.slice(1))}.`
  }</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-collapse:collapse">
${rows}
<tr><td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#1f2a3a">${paid ? "Paid" : "To pay"}</td><td style="padding:12px 0 0 16px;font-size:18px;font-weight:700;color:#1f2a3a;text-align:right">${formatPence(r.amountPence)}</td></tr>
</table>
${
    r.status === "open" && r.offers.some((o) => !o.taken)
      ? `<div style="margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#f7f5f2;font-size:15px;line-height:1.5;color:#1f2a3a"><p style="margin:0 0 6px;font-weight:700">While we're with you</p>${r.offers
          .filter((o) => !o.taken)
          .map((o) => `<p style="margin:0">${escapeHtml(o.label)}: <strong>${formatPence(o.pence)}</strong>${o.usualPence ? ` (usually ${formatPence(o.usualPence)})` : ""}</p>`)
          .join("")}<p style="margin:6px 0 0;color:#5b6573;font-size:14px">Add with one tick when you pay.</p></div>`
      : ""
  }
<p style="margin:0;font-size:13px;line-height:1.5;color:#5b6573">${escapeHtml(business.fullName)} · Gas Safe registered ${escapeHtml(business.gasSafeNumber)}</p>`;

  return renderEmailLayout({
    previewText: `${heading}: ${formatPence(r.amountPence)}${paid ? " paid" : ""}`,
    heading,
    bodyHtml,
    ctaLabel: paid ? "View receipt" : `Pay ${formatPence(r.amountPence)}`,
    ctaUrl: link,
    secondaryCtaLabel: `Call ${business.phoneDisplay}`,
    secondaryCtaUrl: business.phoneHref,
  });
}
