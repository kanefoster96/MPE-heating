// UK phone rules, ported from Kanvas Academy (src/lib/phone.ts).
// normalizePhone turns any spelling into E.164 so the enquiry email can
// carry a tap-to-call link; formatPhone writes it the way people read it.

export const PHONE_EXAMPLE = "07123 456789";
export const PHONE_ERROR = `Enter a valid UK phone number, e.g. ${PHONE_EXAMPLE}.`;

/**
 * "07700 900123", "+44 7700 900123", "(0191) 234-5678", "00447700900123" →
 * "+447700900123" / "+441912345678". UK mobiles are 07 + 9 digits; UK
 * landlines 01/02/03 + 8 or 9 digits. Any other country is accepted as
 * "+" and 8–15 digits. Anything else (too short, letters, a made-up
 * prefix, a repeated or sequential placeholder, an Ofcom drama number)
 * is null.
 */
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+44")) s = `0${s.slice(3)}`;
  else if (/^44\d{10}$/.test(s)) s = `0${s.slice(2)}`;

  if (s.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(s) && !isPlaceholderDigits(s.slice(1)) ? s : null;
  if (!/^\d+$/.test(s)) return null;
  if (isPlaceholderDigits(s.slice(2)) || FICTIONAL_UK.some((p) => s.startsWith(p))) return null;
  if (/^07\d{9}$/.test(s)) return `+44${s.slice(1)}`;
  if (/^0[123]\d{8,9}$/.test(s)) return `+44${s.slice(1)}`;
  return null;
}

// Ofcom's numbers reserved for TV and examples: never a real person.
const FICTIONAL_UK = ["07700900", "01914980", "02079460", "01632960"];

// Made-up numbers typed to get past the form: one digit repeated
// ("0000000"), or a straight run ("123456789").
function isPlaceholderDigits(digits: string): boolean {
  if (digits.length < 6) return false;
  if (/^(\d)\1+$/.test(digits)) return true;
  return "01234567890".includes(digits) || "98765432109".includes(digits);
}

/** E.164 → how it's written: "07700 900123", "0191 234 5678"; other countries stay as "+…". */
export function formatPhone(e164: string): string {
  if (!e164.startsWith("+44")) return e164;
  const national = `0${e164.slice(3)}`;
  if (national.startsWith("07") && national.length === 11) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  if (national.length === 11) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `${national.slice(0, 4)} ${national.slice(4)}`;
  }
  return national;
}

/** A real number, any spelling. */
export function isRealPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
