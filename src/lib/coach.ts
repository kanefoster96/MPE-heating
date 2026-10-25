import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDisplayName } from "@/lib/display-name";
import { staffProfiles } from "@/lib/staff-identity";
import { provenEmail } from "@/lib/email-proof";

// Only an address the account has proved is its own (lib/email-proof.ts):
// roles are given by email, sometimes before the coach has an account, and
// an account made by booking a trial in the app with that address mustn't
// pick the role up.
async function emailForUserId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return provenEmail(data?.user)?.toLowerCase() ?? null;
}

// user_roles has no RLS policies at all — only the service-role client can
// read it, so this check can't be spoofed by a regular user. Labels are
// assigned by email, so we resolve the user's email first.
export async function isCoach(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const email = await emailForUserId(admin, userId);
  if (!email) return false;

  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .in("role", ["coach", "admin"])
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const email = await emailForUserId(admin, userId);
  if (!email) return false;

  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  return !!data;
}

export type CoachRosterEntry = { id: string; email: string; name: string; role: string };

/**
 * Every account with a coach/admin label — used for the chat "pass to"
 * picker and for who gets staff alerts.
 *
 * Looked up one staff email at a time rather than by listing every account:
 * one account Supabase can't read (a ban set to "infinity", 17 Oct 2026)
 * makes the full list fail, and this then came back empty, so every staff
 * alert went to nobody without a word for three days.
 */
export async function getCoachRoster(): Promise<CoachRosterEntry[]> {
  const admin = createAdminClient();

  const { data: roles, error: rolesError } = await admin.from("user_roles").select("email, role");
  if (rolesError) console.error("getCoachRoster: could not read user_roles", rolesError);
  const roleByEmail = new Map((roles ?? []).map((r) => [r.email.toLowerCase(), r.role as string]));
  if (roleByEmail.size === 0) return [];
  const profiles = await staffProfiles(admin);

  const entries = await Promise.all(
    [...roleByEmail].map(async ([email, role]): Promise<CoachRosterEntry | null> => {
      const { data: id, error } = await admin.rpc("user_id_for_email", { check_email: email });
      if (error) {
        console.error("getCoachRoster: lookup failed", email, error);
        return null;
      }
      // A role given before the coach has made their account.
      if (!id) return null;
      const { data, error: userError } = await admin.auth.admin.getUserById(id as string);
      const u = data?.user;
      if (userError || !u) {
        console.error("getCoachRoster: could not read account", email, userError);
        return null;
      }
      if (u.is_anonymous || !u.email) return null;
      // The name an admin set for them on Manage Access, else their own.
      return { id: u.id, email: u.email, name: profiles.get(email)?.displayName?.trim() || resolveDisplayName(u), role };
    }),
  );
  return entries.filter((e): e is CoachRosterEntry => e !== null);
}

/** Same check as isCoach, batched for a list of authors (e.g. a feed of posts). */
export async function coachIdSet(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Set();

  const admin = createAdminClient();

  const emailByUserId = new Map<string, string>();
  for (const uid of uniqueIds) {
    const email = await emailForUserId(admin, uid);
    if (email) emailByUserId.set(uid, email);
  }

  const { data: roles } = await admin
    .from("user_roles")
    .select("email")
    .in("role", ["coach", "admin"]);

  const roleEmails = new Set((roles ?? []).map((r) => r.email.toLowerCase()));

  const result = new Set<string>();
  for (const [uid, email] of emailByUserId) {
    if (roleEmails.has(email)) result.add(uid);
  }
  return result;
}

/**
 * Whether a coach or admin role has been given to this address. Accounts
 * for these addresses are only made through an emailed code (the app's log
 * in screens, src/app/api/mobile/auth), never by booking a trial or signing
 * up on the website, which don't prove the address: a role is often given
 * before the coach has an account, and whoever made that account first
 * would otherwise be staff.
 */
export async function emailHasStaffRole(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("user_roles")
    .select("role")
    .eq("email", email.trim().toLowerCase())
    .in("role", ["coach", "admin"])
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("emailHasStaffRole: lookup failed", error);
    // Fail closed: a parent who hits this can still set up with a code.
    return true;
  }
  return !!data;
}
