/**
 * A Supabase auth user's own display name — full_name from user_metadata
 * (set at signup) when present, falling back to their email since not every
 * account has a name on file (older accounts, some staff accounts created
 * before this field existed).
 *
 * How a member of staff appears to families is set by an admin on Manage
 * Access ("Coach Marshal", lib/staff-identity.ts) and wins over this
 * wherever a family reads it.
 */
export function resolveDisplayName(
  user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined,
  fallback = "Unknown",
): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  return fullName || user?.email || fallback;
}
