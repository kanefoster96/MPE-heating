import type { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClient as makeAdminClient } from "@/lib/supabase/admin";
import { resolveDisplayName } from "@/lib/display-name";

type Admin = ReturnType<typeof createAdminClient>;
type UserLike = { id?: string | null; email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined;

/**
 * How a member of staff appears to families: the display name and photo an
 * admin chose for them (staff_profiles, keyed by email), or else what the
 * site used before (resolveDisplayName: their coach name, then the name
 * they signed up with, then their email) and the photo they uploaded
 * themselves. A chosen name and photo only apply while the email still has
 * coach or admin access: someone removed goes back to their own.
 *
 * Used wherever a family reads who wrote something: chat replies (looked
 * up as the chat loads, so old messages follow a change), and the name
 * saved with a new post, comment, event-day post or notification. A change
 * here also rewrites the name on their past posts (setStaffProfile).
 *
 * `name` is "" for an account with no name or email at all (a paired
 * dancer device), so each caller keeps its own word for that ("Member").
 */
export type StaffIdentity = { name: string; avatarUrl: string | null };

type Profile = { displayName: string | null; avatarUrl: string | null };

let cache: { at: number; byEmail: Map<string, Profile> } | null = null;
const CACHE_MS = 60_000;

/** Staff profiles for everyone (or one email) who still has staff access. */
async function readProfiles(admin: Admin, email?: string): Promise<Map<string, Profile> | null> {
  let profiles = admin.from("staff_profiles").select("email, display_name, avatar_url");
  let roles = admin.from("user_roles").select("email");
  if (email) {
    profiles = profiles.eq("email", email);
    roles = roles.eq("email", email);
  }
  const [p, r] = await Promise.all([profiles, roles]);
  if (p.error || r.error) {
    // Not set up yet (an older club's database): fall back to how names were before.
    console.error("staffProfiles: read failed", p.error ?? r.error);
    return null;
  }
  const staff = new Set(((r.data ?? []) as { email: string }[]).map((row) => row.email.toLowerCase()));
  return new Map(
    ((p.data ?? []) as { email: string; display_name: string | null; avatar_url: string | null }[])
      .filter((row) => staff.has(row.email.toLowerCase()))
      .map((row) => [row.email.toLowerCase(), { displayName: row.display_name, avatarUrl: row.avatar_url }]),
  );
}

/** Every staff profile, at most a minute old unless `fresh`. For reads (the chat); writes use staffIdentity's fresh read. */
export async function staffProfiles(admin: Admin = makeAdminClient(), opts: { fresh?: boolean } = {}): Promise<Map<string, Profile>> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.byEmail;
  // A failed read is cached too, so a club without the table isn't asked every time.
  const byEmail = (await readProfiles(admin)) ?? new Map<string, Profile>();
  cache = { at: Date.now(), byEmail };
  return byEmail;
}

/**
 * The display name and photo families see for this user. Read fresh by
 * default, since a name saved with a post stays; `cached` (the chat, which
 * looks it up on every load) accepts one up to a minute old.
 */
export async function staffIdentity(user: UserLike, admin?: Admin, opts: { cached?: boolean } = {}): Promise<StaffIdentity> {
  const email = user?.email?.toLowerCase();
  let profile: Profile | undefined;
  if (email) {
    profile = opts.cached ? (await staffProfiles(admin)).get(email) : (await readProfiles(admin ?? makeAdminClient(), email))?.get(email);
  }
  return {
    name: profile?.displayName?.trim() || resolveDisplayName(user, ""),
    avatarUrl: profile?.avatarUrl || ((user?.user_metadata?.avatar_url as string | undefined) ?? null),
  };
}

/** The admin-set profile for an email, if any, freshly read (whether or not they're still staff). */
export async function getStaffProfile(admin: Admin, email: string): Promise<Profile | null> {
  const { data } = await admin.from("staff_profiles").select("display_name, avatar_url").eq("email", email.toLowerCase()).maybeSingle();
  return data ? { displayName: data.display_name, avatarUrl: data.avatar_url } : null;
}

type Account = { id: string; email: string | null; user_metadata: Record<string, unknown>; lastSignInAt: string | null };

/**
 * The account with this email, if they've signed up. One lookup by email
 * rather than listing every account: one account Supabase can't read makes
 * the whole list fail (see getCoachRoster in lib/coach.ts).
 */
export async function userForEmail(admin: Admin, email: string): Promise<Account | null> {
  const { data: id, error } = await admin.rpc("user_id_for_email", { check_email: email.toLowerCase() });
  if (error) {
    console.error("userForEmail: lookup failed", error);
    return null;
  }
  if (!id) return null;
  const { data, error: userError } = await admin.auth.admin.getUserById(id as string);
  if (userError || !data?.user) {
    console.error("userForEmail: could not read account", userError);
    return null;
  }
  const u = data.user;
  return { id: u.id, email: u.email ?? null, user_metadata: u.user_metadata ?? {}, lastSignInAt: u.last_sign_in_at ?? null };
}

/**
 * Saves the display name and/or photo for a member of staff (null clears
 * one, undefined leaves it), then puts the result on everything they've
 * already posted, commented or sent, so families see one name for them.
 * Returns the replaced photo's URL so the caller can tidy it away.
 */
export async function setStaffProfile(
  admin: Admin,
  email: string,
  change: { displayName?: string | null; avatarUrl?: string | null },
  actorEmail: string | null,
): Promise<StaffIdentity & { replacedAvatarUrl: string | null }> {
  const target = email.trim().toLowerCase();
  const user = await userForEmail(admin, target);
  const subject = user ?? { email: target };
  const before = await getStaffProfile(admin, target);
  const row = {
    email: target,
    display_name: change.displayName !== undefined ? change.displayName?.trim() || null : (before?.displayName ?? null),
    avatar_url: change.avatarUrl !== undefined ? change.avatarUrl : (before?.avatarUrl ?? null),
    updated_by: actorEmail,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("staff_profiles").upsert(row, { onConflict: "email" });
  if (error) throw error;
  cache = null;

  const identity = await staffIdentity(subject, admin);
  // Kanvas Academy also backfills the name onto past posts and
  // notifications here; MPE has neither, and chat messages read the name
  // live, so there's nothing to update.
  const replacedAvatarUrl = before?.avatarUrl && before.avatarUrl !== row.avatar_url ? before.avatarUrl : null;
  return { ...identity, replacedAvatarUrl };
}
