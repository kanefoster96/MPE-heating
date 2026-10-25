// Shared client-side validation for the contact form. This is UX-layer
// validation only — the server route (src/app/api/contact/route.ts)
// re-checks the same fields before sending anything.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s()-]/g, "");
  return /^\+?\d{9,15}$/.test(digits);
}

// A UK postcode, with or without the space (e.g. "NE26 1AB", "ne261ab").
export function isValidPostcode(value: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

// "ne261ab" -> "NE26 1AB".
export function formatPostcode(value: string): string {
  const v = value.replace(/\s+/g, "").toUpperCase();
  return v.length > 3 ? `${v.slice(0, -3)} ${v.slice(-3)}` : v;
}
