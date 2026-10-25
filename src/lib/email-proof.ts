import type { User } from "@supabase/supabase-js";

/**
 * Whether an account has shown it owns its email address.
 *
 * Plenty of what we hold is found by email: a trial booked on the website,
 * an old order, a loyalty price, a family moving across from another club.
 * An account that hasn't proved its address mustn't be handed any of it.
 *
 * Accounts made by booking a free trial in the app (from app 1.1.0) are
 * signed straight in, with no code to fetch from an inbox first — booking
 * a trial is meant to take a couple of minutes. They carry
 * `app_metadata.email_unverified` until the parent proves the address: by
 * tapping "Confirm my email" in the email sent as soon as they chose a
 * password (lib/email-confirm-link.ts), or by setting a password with a
 * code from the log in screens. Paying for a membership waits for it, so
 * the link goes early and is usually done long before.
 *
 * A link is weaker than a code typed into the account's own app: the real
 * owner of an address someone else typed could tap it. So the link's page
 * asks for a tap (a mail scanner opening links can't confirm it), and the
 * email says it's for a free trial booked in the app and to ignore it
 * otherwise. app_metadata can only be written with the service key, so
 * nobody can clear the mark on their own.
 *
 * Until then such an account sees what it booked itself (rows carrying its
 * user_id) and nothing matched only by email. Every other account counts as
 * proved, as it always has.
 */

export const EMAIL_UNVERIFIED_FLAG = "email_unverified";

type MaybeUser = Pick<User, "email" | "email_confirmed_at" | "app_metadata"> | null | undefined;

export function emailProven(user: MaybeUser): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return user.app_metadata?.[EMAIL_UNVERIFIED_FLAG] !== true;
}

/** The email to match records by, or null when the account hasn't proved it. */
export function provenEmail(user: MaybeUser): string | null {
  return emailProven(user) ? (user?.email ?? null) : null;
}
