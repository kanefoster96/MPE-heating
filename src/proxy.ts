import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy`. This runs on every request
 * (except static assets, see matcher below) to keep the Supabase auth
 * session cookie refreshed — without this, sessions can go stale because
 * Server Components can read cookies but can't write them.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Supabase isn't configured yet (.env.local is empty) — let pages that
    // don't need auth render instead of crashing the whole site.
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching the session here is what actually refreshes an expiring token.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // .well-known/ is the app-link files Apple and Google fetch
    // (src/app/.well-known): nobody's signed in there, and they must come
    // back exactly as built, so the session refresh stays out of the way.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|brand/|icons/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
