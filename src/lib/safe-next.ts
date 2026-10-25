/**
 * A "next" path we can safely send someone to after logging in: a path on
 * this site only. Rejects full URLs, protocol-relative "//evil.com", the
 * backslash form "/\\evil.com" browsers treat the same way, and "@" tricks.
 */
export function safeNextPath(next: unknown): string | null {
  const value = String(next ?? "");
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://kanvas.invalid");
    if (url.origin !== "https://kanvas.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
