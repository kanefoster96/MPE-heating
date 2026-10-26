import { SITE_URL } from "@/lib/site";

const TIMEOUT_MS = 15_000;
const cache = new Map<string, unknown>();

/** The last successful response for a path, so a screen can paint at once and refresh behind (Kanvas Academy's api-cache). */
export function readCached<T>(path: string): T | undefined {
  return cache.get(path) as T | undefined;
}

/** GET a site API path as JSON, with a timeout so a dead connection says so instead of spinning. */
export async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SITE_URL}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Couldn't load that (${res.status}).`);
    const data = (await res.json()) as T;
    cache.set(path, data);
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("No connection. Check your signal and try again.");
    if (err instanceof TypeError) throw new Error("No connection. Check your signal and try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
