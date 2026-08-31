// Carries the contact-form submission across to /create-account (a plain
// client-side navigation, not a real multi-step form) so the customer
// isn't asked to retype their name/phone/email/problem a second time.
// sessionStorage rather than query params so the problem description
// doesn't end up dumped in the URL/browser history.
export const CONTACT_HANDOFF_KEY = "mpe:contactHandoff";

export type ContactHandoff = {
  name: string;
  phone: string;
  email: string;
  message: string;
  sameDayRequested: boolean;
};

export function readContactHandoff(): ContactHandoff | null {
  try {
    const raw = sessionStorage.getItem(CONTACT_HANDOFF_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ContactHandoff;
  } catch {
    return null;
  }
}

export function clearContactHandoff() {
  try {
    sessionStorage.removeItem(CONTACT_HANDOFF_KEY);
  } catch {
    // Ignore — nothing to clean up if storage isn't available.
  }
}
