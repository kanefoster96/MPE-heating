import { renderEmailLayout } from "./layout";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function contactMessageEmailHtml(params: { subject: string; message: string }): string {
  const { subject, message } = params;

  const bodyHtml = message
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return renderEmailLayout({
    previewText: subject,
    heading: subject,
    bodyHtml,
  });
}
