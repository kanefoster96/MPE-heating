// Direct contact links for the admin screens — lets Fergal ring, WhatsApp
// or email a customer straight from their card/profile. These are plain
// protocol links, so they work today with no backend at all.

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

// wa.me needs the number in international format with no leading zeros or
// punctuation — a UK "07…" mobile becomes "447…". Numbers already given
// with a country code pass through untouched.
export function waHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
