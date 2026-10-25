// Ported from Kanvas Academy (src/lib/email-typo.ts).
/**
 * Catching a mistyped email before it's saved: "gmil.com", "hotmial.co.uk",
 * "icloud.con". A booking under a wrong address looks fine on screen and
 * then nothing arrives — no QR, no reminders — so a parent who misses this
 * finds out at the studio door.
 *
 * Only addresses that look like a slip of a well-known provider are
 * questioned. A known provider spelled right, or a domain we don't know
 * (a work or school address), goes straight through: worst case it bounces
 * and gets fixed on the day, which is better than nagging everyone.
 */

const KNOWN_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "live.co.uk",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  "aol.co.uk",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
  "ntlworld.com",
  "blueyonder.co.uk",
  "tiscali.co.uk",
  "mail.com",
  "gmx.com",
  "gmx.co.uk",
  "protonmail.com",
  "proton.me",
];

const KNOWN = new Set(KNOWN_DOMAINS);

/** Endings that are never right: ".con" for ".com" and the like. */
const BAD_ENDINGS: [RegExp, string][] = [
  [/\.(con|cpm|cim|xom|vom|comm|cm|om|co,)$/, ".com"],
  [/\.(couk|co\.k|co\.ul|co\.uj|cp\.uk|co\.u|o\.uk)$/, ".co.uk"],
];

/** Edit distance counting a swapped pair of letters as one slip ("gmial"). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Null when the address is fine to use as typed. Otherwise the address it
 * probably should be, or null for the suggestion when we can tell it's wrong
 * but not what it should be.
 */
export function emailTypoCheck(email: string): { suggestion: string | null } | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain || KNOWN.has(domain)) return null;

  let fixed = domain;
  for (const [pattern, ending] of BAD_ENDINGS) fixed = fixed.replace(pattern, ending);
  if (KNOWN.has(fixed)) return { suggestion: `${local}@${fixed}` };

  // Closest known provider, if it's within a slip or two. Short domains get
  // less leeway so "me.com" doesn't swallow every three-letter address.
  let best: { domain: string; d: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const d = distance(fixed, known);
    if (!best || d < best.d) best = { domain: known, d };
  }
  const allowed = best && best.domain.length <= 7 ? 1 : 2;
  if (best && best.d <= allowed) return { suggestion: `${local}@${best.domain}` };

  // Not near anything we know, but the ending itself was wrong.
  if (fixed !== domain) return { suggestion: `${local}@${fixed}` };
  return null;
}
