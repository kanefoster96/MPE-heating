import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The app's Supabase connection: signing in (an email code, or an
 * anonymous guest for chat), the chat's live updates and photo uploads.
 * Everything that needs the service-role key goes through the website's
 * /api/mobile routes instead (lib/api.ts).
 *
 * Off (null) until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are set: the app then works as a brochure, and chat and sign-in say
 * they're coming soon. Use the project's publishable key (sb_publishable_…):
 * Kanvas Academy found some phones mangle the older JWT-shaped anon key in
 * transit.
 */

const strip = (value: string | undefined) => (value ?? "").trim().replace(/^["']+|["']+$/g, "");
const url = strip(process.env.EXPO_PUBLIC_SUPABASE_URL).split("?")[0].replace(/\/+$/, "");
const key = strip(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Makes a new session's expiry count from this phone's clock, not the
 * server's (Kanvas Academy's fix): on a phone whose clock runs fast, a
 * token minted a second ago otherwise already looks expired, and the app
 * refreshes in a loop. The server still checks the token against its own
 * clock, so nothing is extended.
 */
async function expiryOnDeviceClock(response: Response): Promise<Response> {
  if (!response.ok) return response;
  try {
    const body = await response.clone().json();
    if (body && typeof body === "object" && "expires_at" in body && "expires_in" in body) {
      delete body.expires_at;
      return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  } catch {
    // Not JSON: leave it alone.
  }
  return response;
}

const fetchWithExpiryFix: typeof fetch = (input, init) => {
  const response = fetch(input, init);
  const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return target.includes("/auth/v1/") ? response.then(expiryOnDeviceClock) : response;
};

export const supabase: SupabaseClient | null =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key
    ? createClient(url, key, {
        auth: {
          // The web preview keeps it in the browser; a phone in AsyncStorage.
          storage: Platform.OS === "web" ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchWithExpiryFix },
      })
    : null;

/** Whether chat and sign-in are switched on in this build. */
export const accountsOn = !!supabase;
