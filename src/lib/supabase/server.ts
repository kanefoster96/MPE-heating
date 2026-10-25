import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Component / Server Action client — reads the caller's session from cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written — the session is still refreshed by proxy.ts on the
            // next request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
