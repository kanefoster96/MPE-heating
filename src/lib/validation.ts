// Shared client-side validation for the account forms. This is UX-layer
// validation only — the real enforcement (uniqueness, rate limiting, hashing)
// has to happen server-side once auth is wired up; see the TODOs in
// src/app/login/page.tsx and src/app/create-account/page.tsx.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s()-]/g, "");
  return /^\+?\d{9,15}$/.test(digits);
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Good" | "Strong";
  color: string;
};

const STRENGTH_LEVELS: PasswordStrength[] = [
  { score: 0, label: "Very weak", color: "bg-terracotta" },
  { score: 1, label: "Weak", color: "bg-terracotta" },
  { score: 2, label: "Fair", color: "bg-yellow" },
  { score: 3, label: "Good", color: "bg-green" },
  { score: 4, label: "Strong", color: "bg-green-dark" },
];

// Rough heuristic (length + character variety), not a full entropy
// calculation — good enough to nudge people toward a stronger password
// without being a false sense of security.
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return STRENGTH_LEVELS[0];

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4) as PasswordStrength["score"];
  return STRENGTH_LEVELS[clamped];
}

export const PASSWORD_MIN_LENGTH = 8;

export function passwordMeetsMinimum(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/i.test(password) &&
    /\d/.test(password)
  );
}
