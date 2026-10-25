import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// Plain anon-key client — this only ever validates a bearer token via
// auth.getUser(token), never touches cookies, so it's safe to share across
// requests unlike the cookie-based src/lib/supabase/server.ts client. Built
// lazily rather than at module scope: the Supabase client throws
// immediately if its URL is missing, and every `/api/mobile/*` route that
// imports getMobileUser pulls this module in too — a module-scope call
// would run the moment any of them is imported, including during Next's
// build-time "collecting page data" pass, before there's a real request.
function getSupabaseAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}

/**
 * Identifies the caller of an `src/app/api/mobile/*` route handler from its
 * `Authorization: Bearer <access_token>` header — the mobile app's
 * equivalent of the cookie-based session `src/lib/supabase/server.ts`'s
 * `createClient()` reads on the website. Returns null for a missing or
 * invalid token, same as the website's `supabase.auth.getUser()` returning
 * no user when logged out.
 */
export async function getMobileUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;

  const {
    data: { user },
  } = await getSupabaseAnonClient().auth.getUser(token);
  return user;
}
