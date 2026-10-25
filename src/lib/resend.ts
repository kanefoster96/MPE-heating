import { Resend } from "resend";
import { CLUB } from "@/lib/club";

/**
 * Only import this from server actions / route handlers that actually send
 * email — not from page components — so pages keep rendering before
 * RESEND_API_KEY is configured.
 */
export const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// The sender for every email the site sends (CONTACT_FROM_EMAIL, the same
// variable the booking forms already used), set to an address at a domain
// verified in Resend.
const SANDBOX_FROM_EMAIL = `${CLUB.name} <onboarding@resend.dev>`;
export const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || SANDBOX_FROM_EMAIL;

// Resend's sandbox domain only delivers to the Resend account's own address
// — every other recipient gets a silent 403 that this app has never
// surfaced anywhere (send failures are caught and logged per-call, but
// nothing distinguishes "Resend is down" from "Resend is refusing this
// domain"). That let production run for a while with every customer-facing
// email quietly failing. This can't fix delivery — CONTACT_FROM_EMAIL still
// has to be set to a verified domain — but it turns the failure mode from
// silent into a loud, once-per-boot log line.
const isProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === "production";
// MPE: only once Resend is switched on (RESEND_API_KEY set).
if (isProduction && process.env.RESEND_API_KEY && FROM_EMAIL === SANDBOX_FROM_EMAIL) {
  console.error(
    "[resend] CONTACT_FROM_EMAIL is not set in production — emails are sending from " +
      `${SANDBOX_FROM_EMAIL}, Resend's sandbox address. Resend silently rejects any ` +
      "recipient other than the account owner's own address from this domain, so " +
      "booking confirmations, chat replies and every other customer email are " +
      "likely failing to deliver right now. Verify a real domain in Resend's " +
      "Domains tab, then set CONTACT_FROM_EMAIL to an address at that domain.",
  );
}

/**
 * Every email the site sends is logged (email_log): who it went to, the
 * subject, the full content and Resend's id. It's the record that shows,
 * for example in a payment dispute, exactly what a family was told and
 * when. Done here, around the client, so no send can skip it.
 */
type SendArgs = Parameters<typeof resend.emails.send>;
const originalSend = resend.emails.send.bind(resend.emails);
resend.emails.send = (async (...args: SendArgs) => {
  const [payload, ...rest] = args;
  const result = await originalSend(inlineDataImages(payload), ...rest);
  // Awaited: on serverless a fire-and-forget write can be cut off when the request ends.
  try {
    await logEmail(args[0], result);
  } catch (err) {
    console.error("[resend] email log failed", err);
  }
  return result;
}) as typeof resend.emails.send;

/**
 * Images written straight into the HTML (QR codes are made that way:
 * `src="data:image/png;base64,..."`) are moved into inline attachments
 * referenced by `cid:`. Gmail, Outlook and others strip data: images, so a
 * parent saw broken alt text where their check-in QR should be; a cid image
 * is shown like any other picture in the email.
 */
const DATA_IMAGE = /src="data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=]+)"/g;

export function inlineDataImages(payload: SendArgs[0]): SendArgs[0] {
  if (!("html" in payload) || typeof payload.html !== "string" || !payload.html.includes("data:image/")) return payload;
  const attachments = [...(payload.attachments ?? [])];
  let n = 0;
  const html = payload.html.replace(DATA_IMAGE, (_match, contentType: string, content: string) => {
    n++;
    const contentId = `inline-image-${n}`;
    const ext = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
    attachments.push({ filename: `${n === 1 ? "qr-code" : `image-${n}`}.${ext}`, content, contentType, contentId });
    return `src="cid:${contentId}"`;
  });
  return n ? { ...payload, html, attachments } : payload;
}

async function logEmail(payload: SendArgs[0], result: Awaited<ReturnType<typeof originalSend>>): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const html = "html" in payload && typeof payload.html === "string" ? payload.html : null;
  await createAdminClient()
    .from("email_log")
    .insert(
      to.filter(Boolean).map((address) => ({
        to_email: String(address).toLowerCase(),
        subject: payload.subject ?? null,
        html,
        resend_id: result.data?.id ?? null,
        error: result.error ? String(result.error.message ?? result.error.name ?? "send failed").slice(0, 500) : null,
      })),
    );
}
