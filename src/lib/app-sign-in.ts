import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { userForEmail } from "@/lib/staff-identity";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { renderEmailLayout } from "@/lib/emails/layout";
import { CLUB_SITE_URL } from "@/lib/club";

/**
 * Signing in to the MPE app with a link, not a code (Kanvas Academy's
 * "Set up my account" link and "Confirm my email" page, without the
 * password: MPE customers sign in rarely, so the link is the sign-in).
 *
 * 1. The app sends their email to /api/mobile/auth/send-link. We email a
 *    "Confirm my email" button to /app-sign-in?t=….
 * 2. Tapped on the phone with the app, that's an app link
 *    (lib/app-links.ts): the app opens and signs straight in
 *    (/api/mobile/auth/confirm-link). Only a person tapping opens an app,
 *    so nothing else can spend it.
 * 3. Opened in a browser instead (no app links yet, or on a computer), the
 *    website's /app-sign-in page asks for a tap first, so a mail scanner
 *    or link preview can't use it up. The tap signs the browser in too,
 *    then hands back to the app with a second short link
 *    (mpe://app-sign-in?h=…), which signs the app in the same way.
 *
 * Whoever reads the inbox owns the address, so the link is the proof. A
 * login is made the first time an address confirms, never before. Only a
 * hash of each link is stored, and each works once.
 */

export const LINK_MINUTES = 60;
const HANDOFF_MINUTES = 10;
const RESEND_WAIT_SECONDS = 60;
const PER_EMAIL_15_MINUTES = 5;
const PER_IP_HOUR = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Kind = "email" | "handoff";
const site = () => CLUB_SITE_URL.replace(/\/$/, "");
const hash = (ticket: string) => crypto.createHash("sha256").update(ticket).digest("hex");
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

async function issue(email: string, kind: Kind, minutes: number, ip: string | null): Promise<string | null> {
  const ticket = crypto.randomBytes(24).toString("base64url");
  const { error } = await createAdminClient()
    .from("app_sign_in_links")
    .insert({ email, kind, token_hash: hash(ticket), ip, expires_at: new Date(Date.now() + minutes * 60_000).toISOString() });
  if (error) {
    console.error("app-sign-in: saving a link failed", error);
    return null;
  }
  return ticket;
}

/**
 * Apple's reviewers can't read a customer's inbox, so one address set in
 * APP_REVIEW_EMAIL signs in with a password instead (made in Supabase by
 * hand). Nobody else is offered a password.
 */
export function isReviewEmail(email: string): boolean {
  const review = normaliseEmail(process.env.APP_REVIEW_EMAIL ?? "");
  return !!review && normaliseEmail(email) === review;
}

export type SendResult = { ok: true; password?: boolean } | { ok: false; error: string; status: number; retryAfter?: number };

/** Step 1: emails the "Confirm my email" button, within limits. */
export async function sendSignInLink(rawEmail: string, ip: string | null): Promise<SendResult> {
  const email = normaliseEmail(rawEmail);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address.", status: 400 };
  if (isReviewEmail(email)) return { ok: true, password: true };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Signing in isn't switched on yet.", status: 503 };

  const admin = createAdminClient();
  const [{ data: last }, { count: recentForEmail }, { count: recentForIp }] = await Promise.all([
    admin.from("app_sign_in_links").select("created_at").eq("email", email).eq("kind", "email").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("app_sign_in_links").select("id", { count: "exact", head: true }).eq("email", email).eq("kind", "email").gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString()),
    ip
      ? admin.from("app_sign_in_links").select("id", { count: "exact", head: true }).eq("ip", ip).eq("kind", "email").gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString())
      : Promise.resolve({ count: 0 }),
  ]);
  const wait = last?.created_at ? Math.ceil(RESEND_WAIT_SECONDS - (Date.now() - new Date(last.created_at as string).getTime()) / 1000) : 0;
  if (wait > 0) return { ok: false, error: `We've just sent one. Please wait ${wait} seconds before asking again.`, status: 429, retryAfter: wait };
  if ((recentForEmail ?? 0) >= PER_EMAIL_15_MINUTES || (recentForIp ?? 0) >= PER_IP_HOUR) {
    return { ok: false, error: "That's a lot of emails in a short time. Please wait a while and try again.", status: 429 };
  }

  const ticket = await issue(email, "email", LINK_MINUTES, ip);
  if (!ticket) return { ok: false, error: "We couldn't send the email just now. Please try again in a minute.", status: 500 };
  const url = `${site()}/app-sign-in?t=${encodeURIComponent(ticket)}`;
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Confirm your email for the MPE app",
      html: renderEmailLayout({
        previewText: "Tap the button to sign in to the MPE app.",
        heading: "Confirm your email",
        bodyHtml: `<p style="margin:0 0 16px">Tap the button below on your phone and the MPE app will sign you in. No password needed.</p><p style="margin:0 0 16px">It works once, for the next ${LINK_MINUTES} minutes. If you didn't ask to sign in, you can ignore this email.</p>`,
        ctaLabel: "Confirm my email",
        ctaUrl: url,
      }),
    });
    if (error) throw error;
  } catch (err) {
    console.error("app-sign-in: email failed", err);
    return { ok: false, error: "We couldn't send the email just now. Please try again in a minute.", status: 500 };
  }
  return { ok: true };
}

/** The address a link is for, without using it up (the website page shows it before the tap). */
export async function peekSignInLink(kind: Kind, ticket: string): Promise<{ state: "ok"; email: string } | { state: "used" | "invalid" }> {
  if (!ticket) return { state: "invalid" };
  const { data } = await createAdminClient().from("app_sign_in_links").select("email, expires_at, used_at").eq("token_hash", hash(ticket)).eq("kind", kind).maybeSingle();
  if (!data) return { state: "invalid" };
  if (data.used_at) return { state: "used" };
  if ((data.expires_at as string) < new Date().toISOString()) return { state: "invalid" };
  return { state: "ok", email: data.email as string };
}

/** Uses a link up: its address, or null if it's unknown, used or out of date. One caller wins. */
export async function spendSignInLink(kind: Kind, ticket: string): Promise<string | null> {
  if (!ticket) return null;
  const now = new Date().toISOString();
  const { data } = await createAdminClient()
    .from("app_sign_in_links")
    .update({ used_at: now })
    .eq("token_hash", hash(ticket))
    .eq("kind", kind)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("email")
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/** Step 3: after the tap on the website, the short link back to the app. */
export async function issueHandoff(email: string): Promise<string | null> {
  return issue(email, "handoff", HANDOFF_MINUTES, null);
}

/**
 * A one-time Supabase sign-in for a confirmed address (the app, or the
 * browser through /auth/confirm, swaps it for a session). Makes the login
 * if this is the address's first time.
 */
export async function sessionTokenFor(email: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!(await userForEmail(admin, email))) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already/i.test(error.message)) {
      console.error("app-sign-in: making the login failed", error);
      return null;
    }
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    console.error("app-sign-in: generateLink failed", error);
    return null;
  }
  return data.properties.hashed_token;
}
