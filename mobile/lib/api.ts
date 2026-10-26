import { SITE_URL } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const TIMEOUT_MS = 15_000;
const cache = new Map<string, unknown>();
const OFFLINE = "No connection. Check your signal and try again.";

/** The last successful response for a path, so a screen can paint at once and refresh behind (Kanvas Academy's api-cache). */
export function readCached<T>(path: string): T | undefined {
  return cache.get(path) as T | undefined;
}

/** The server said no (`status`), as opposed to no signal. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function send(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${SITE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error(OFFLINE);
  } finally {
    clearTimeout(timer);
  }
}

async function read<T>(res: Response, path: string, method: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Couldn't load that (${res.status}).`, res.status);
  }
  const data = (await res.json()) as T;
  if (method === "GET") cache.set(path, data);
  return data;
}

/** GET a public site API path as JSON (services, prices, guides), with a timeout so a dead connection says so instead of spinning. */
export async function apiGet<T>(path: string): Promise<T> {
  return read<T>(await send(path), path, "GET");
}

/** The signed-in session's token, refreshed if it's about to run out. */
async function accessToken(forceRefresh = false): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const soon = !!session.expires_at && session.expires_at - Date.now() / 1000 < 60;
  if (!forceRefresh && !soon) return session.access_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? session.access_token;
}

/**
 * Calls one of the website's /api/mobile routes as the signed-in customer
 * (or guest, or the team): their session goes as a Bearer token, and a 401
 * is tried once more with a fresh token before it counts.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  let token = await accessToken();
  let res = await send(path, init, token);
  if (res.status === 401 && token) {
    token = await accessToken(true);
    res = await send(path, init, token);
  }
  return read<T>(res, path, method);
}

/** A POST with a JSON body. */
export function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}
