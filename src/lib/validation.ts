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
