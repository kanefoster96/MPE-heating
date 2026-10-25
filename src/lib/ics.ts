/**
 * A visit as a calendar file (.ics), so a customer can add it to their phone's
 * calendar in one tap. Times are written in UTC, worked out from the London
 * day and minutes (so BST and GMT both come out right).
 */

/** The UTC instant for a London wall-clock time. */
export function londonToUtc(dayISO: string, minutes: number): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  // London's offset from UTC at that moment (0 in winter, 60 minutes in summer).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLondon = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLondon - guess));
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function visitIcs(v: { uid: string; title: string; day: string; start: number; end: number; location: string; description: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MPE//Visits//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${v.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(londonToUtc(v.day, v.start))}`,
    `DTEND:${stamp(londonToUtc(v.day, v.end))}`,
    `SUMMARY:${escapeText(v.title)}`,
    ...(v.location ? [`LOCATION:${escapeText(v.location)}`] : []),
    `DESCRIPTION:${escapeText(v.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
