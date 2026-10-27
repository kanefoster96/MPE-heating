import { confirmAction, notify } from "@/lib/confirm";
import { openExternal } from "@/lib/open-link";

/** From the site when a price, invoice or receipt couldn't reach them: their number and the message, ready to send. */
export type WhatsAppHandoff = { phone: string; text: string };

/**
 * A customer who's only ever phoned (no email, not in the app) can't be
 * sent a price or an invoice, so it's offered on WhatsApp Business instead:
 * their chat opens with the message and link typed in, and he taps send.
 * Free, and rare once they've got the app. Without a handoff, just the
 * message.
 */
export async function reportSend(title: string, res: { message: string; whatsapp?: WhatsAppHandoff | null }): Promise<void> {
  if (!res.whatsapp) {
    notify(title, res.message);
    return;
  }
  const open = await confirmAction(
    "Open in WhatsApp Business?",
    `${res.message} Send it from WhatsApp Business instead: their chat opens with the message and link ready.`,
    "Open WhatsApp",
  );
  if (open) openExternal(`https://wa.me/${res.whatsapp.phone}?text=${encodeURIComponent(res.whatsapp.text)}`);
}
