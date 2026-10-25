import { renderEmailLayout } from "./layout";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * "You've got a reply" — sent to someone who wrote in through the website
 * chat and isn't currently in it when a coach answers (see
 * lib/chat-notify.ts). Shows the reply itself, so the email alone is enough
 * to act on, then offers the two ways back: reply to this email (lands in
 * the chat via the Resend inbound webhook) or open the chat.
 */
export function chatReplyEmailHtml(params: {
  coachName: string;
  message: string;
  chatUrl: string;
  canReplyByEmail: boolean;
}): string {
  const { coachName, message, chatUrl, canReplyByEmail } = params;

  const quoted = message
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(coachName)} replied to your message:</p>
    <blockquote style="margin:0 0 20px; padding:14px 18px; border-left:3px solid #08080a; background:#f4f4f2; border-radius:0 8px 8px 0;">
      ${quoted}
    </blockquote>
    <p style="margin:0;">
      ${
        canReplyByEmail
          ? "Just reply to this email and it'll go straight back to us in the chat, or open the chat below."
          : "Open the chat below to reply."
      }
    </p>`;

  return renderEmailLayout({
    previewText: `${coachName}: ${message.slice(0, 120)}`,
    heading: "You've got a reply",
    bodyHtml,
    ctaLabel: "Open the chat",
    ctaUrl: chatUrl,
  });
}
