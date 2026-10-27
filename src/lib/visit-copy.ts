import { KIND_LABEL, PART_LABEL, longDate, windowLabel, type AppointmentKind, type Part } from "@/lib/day-plan";

/**
 * What a customer is told about a visit, as plain words: the chat message,
 * the text and the email all start from here, and the team's add-visit form
 * shows the same words as a preview. No DB or server imports.
 */

export type NoticeType =
  | "booked"
  | "moved"
  | "cancelled"
  | "requested"
  // Automatic (lib/follow-up-sweep.ts): the evening before, an hour before
  // the window, the day after a "Not in", and a year after a service.
  | "reminder"
  | "hour"
  | "missed"
  // A request whose day went by without us booking it.
  | "past_request"
  // Running late: the arrival window's moved on (lib/visit-notify.ts sendRunningLate).
  | "late"
  | "service_due";

export type VisitFacts = {
  kind: AppointmentKind;
  day: string;
  start: number;
  end: number;
  part?: Part | null;
  address?: string | null;
  postcode?: string | null;
  /** A return visit: what we're coming back for ("fit the new diverter valve"). */
  returning?: string | null;
  /** A call-out's fee, said when it's booked ("£50"); none on the maintenance plan. */
  calloutFee?: string | null;
};

/** "Tuesday 27 October, between 8am and 12pm". */
export function whenLine(v: VisitFacts): string {
  return `${longDate(v.day)}, between ${windowLabel(v.start, v.end).replace("–", " and ")}`;
}

/** "Tuesday 27 October, morning" for a request. */
export function requestedWhen(day: string, part: Part | null | undefined): string {
  return `${longDate(day)}${part && part !== "any" ? `, ${PART_LABEL[part].toLowerCase()}` : ""}`;
}

function kindName(kind: AppointmentKind): string {
  return kind === "other" ? "visit" : KIND_LABEL[kind].toLowerCase();
}

/** What the visit is, in a sentence: "call-out", or "return visit to fit the new diverter valve". */
function visitName(v: VisitFacts): string {
  if (!v.returning) return kindName(v.kind);
  const what = v.returning.trim().replace(/\.$/, "");
  return `return visit to ${what.charAt(0).toLowerCase()}${what.slice(1)}`;
}

const HEADLINE: Record<NoticeType, (v: VisitFacts) => string> = {
  booked: (v) => (v.returning ? "You're booked in for your return visit" : `You're booked in for your ${kindName(v.kind)}`),
  moved: (v) => (v.returning ? "Your return visit has moved" : `Your ${kindName(v.kind)} has moved`),
  cancelled: (v) => (v.returning ? "Your return visit is cancelled" : `Your ${kindName(v.kind)} is cancelled`),
  reminder: (v) => (v.returning ? "See you tomorrow to finish the job" : `See you tomorrow for your ${kindName(v.kind)}`),
  requested: (v) => `We've got your ${kindName(v.kind)} request`,
  hour: (v) => (v.returning ? "Confirming today's return visit" : `Confirming today's ${kindName(v.kind)}`),
  missed: () => `Sorry we missed you`,
  past_request: () => `Sorry, we didn't get to you`,
  late: () => `Your arrival time has changed`,
  service_due: () => `Your boiler service is due`,
};

/** The email subject and the first line everywhere. */
export function noticeHeadline(type: NoticeType, v: VisitFacts): string {
  return HEADLINE[type](v);
}

/**
 * The message itself. `link` is the customer's page for this visit, where
 * they can see it, add it to their calendar or ask for another time.
 */
export function noticeBody(
  type: NoticeType,
  v: VisitFacts,
  opts: { link?: string; phone: string; name?: string | null; engineer?: string | null; bookLink?: string; payLink?: string | null },
): string {
  // Always a greeting, so no message starts in lower case without a name.
  const hi = opts.name ? `Hi ${opts.name.split(" ")[0]}, ` : "Hi, ";
  const what = visitName(v);
  const where = [v.address, v.postcode].filter(Boolean).join(", ");
  const cantMake = `If you can't make it, let us know${opts.link ? `: ${opts.link}` : ` on ${opts.phone}`}`;
  // MPE's engineer by name, as the one on their job ("your MPE engineer, Fergal").
  const yourEngineer = opts.engineer ? `your MPE engineer, ${opts.engineer},` : "your MPE engineer";
  const engineerLine = opts.engineer ? ` Your MPE engineer will be ${opts.engineer}.` : "";
  const feeLine = v.calloutFee && v.kind === "callout" ? ` The call-out is ${v.calloutFee}, taken off your repair bill if you go ahead.` : "";
  // Paying it ahead from their phone (lib/callout-prepay.ts), or on the day.
  const payLine = feeLine && opts.payLink ? ` You can pay it now: ${opts.payLink} Or pay ${opts.engineer ?? "your engineer"} on the day.` : "";
  switch (type) {
    case "booked":
      return `${hi}you're booked in for your ${what} on ${whenLine(v)}${where ? ` at ${where}` : ""}.${engineerLine}${feeLine}${payLine} ${cantMake}`;
    case "moved":
      return `${hi}your ${what} has moved to ${whenLine(v)}${where ? ` at ${where}` : ""}. ${cantMake}`;
    case "cancelled":
      return `${hi}your ${what} on ${longDate(v.day)} is cancelled. If you'd still like a visit, just reply or call us on ${opts.phone}.`;
    case "reminder":
      return `${hi}a reminder that we're with you tomorrow for your ${what}, ${whenLine(v).replace(/^[^,]+, /, "")}. ${cantMake}`;
    case "hour":
      // The Academy's hour-before text: a named person expected at the
      // door, and nothing to do. No way out offered, just the number.
      return `${hi}just confirming ${yourEngineer} will be with you today between ${windowLabel(v.start, v.end).replace("–", " and ")} for your ${what}. If you won't be in, let us know${opts.link ? `: ${opts.link}` : `, call ${opts.phone}`}`;
    case "late":
      return `${hi}sorry, we're running behind today. ${yourEngineer.charAt(0).toUpperCase()}${yourEngineer.slice(1)} will now be with you between ${windowLabel(v.start, v.end).replace("–", " and ")}. If you won't be in, let us know${opts.link ? `: ${opts.link}` : `, call ${opts.phone}`}`;
    case "missed":
      return `${hi}we called round for your ${what} on ${longDate(v.day)} but couldn't get in. No problem, pick another time that suits${opts.link ? `: ${opts.link}` : ` and call us on ${opts.phone}`}`;
    case "past_request":
      return `${hi}sorry, we didn't get to your ${what} request for ${requestedWhen(v.day, v.part)}. Pick another day that suits${opts.link ? `: ${opts.link}` : ` and call us on ${opts.phone}`}`;
    case "service_due":
      return `${hi}it's nearly a year since your boiler ${v.kind === "install" ? "was fitted" : "was last serviced"}, so its annual service is due. A yearly service keeps it safe and its warranty valid. Book a time that suits${opts.bookLink ? `: ${opts.bookLink}` : ` by calling ${opts.phone}`}`;
    case "requested":
      return `${hi}thanks, we've got your request for a ${kindName(v.kind)} on ${requestedWhen(v.day, v.part)}. We'll be in touch to confirm the time.${v.kind === "callout" || v.kind === "repair" ? ` If it's urgent, call us on ${opts.phone}.` : ""}${opts.link ? ` Your request: ${opts.link}` : ""}`;
  }
}

const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/**
 * The one-segment version for a text (under 160 characters with "MPE: "
 * in front), for the few that go by text (lib/visit-notify.ts): a booking,
 * a move or a cancellation when there's no email or app, and running
 * late. They point at the app, so the next update's free.
 */
export function shortNotice(type: NoticeType, v: VisitFacts, opts: { name?: string | null; engineer?: string | null; appLink: string }): string | undefined {
  const hi = opts.name ? `Hi ${opts.name.split(" ")[0]}, ` : "Hi, ";
  const what = v.returning ? "return visit" : kindName(v.kind);
  const day = SHORT_DAY.format(new Date(`${v.day}T12:00:00Z`));
  const window = windowLabel(v.start, v.end);
  switch (type) {
    case "booked":
      return `${hi}you're booked in for your ${what} on ${day}, ${window}. Get the MPE app for updates: ${opts.appLink}`;
    case "moved":
      return `${hi}your ${what} has moved to ${day}, ${window}. Get the MPE app for updates: ${opts.appLink}`;
    case "cancelled":
      return `${hi}your ${what} on ${day} is cancelled. To rebook, live chat with us in the MPE app: ${opts.appLink}`;
    case "late":
      return `${hi}sorry, we're running behind. ${opts.engineer ? `${opts.engineer}, your MPE engineer,` : "Your MPE engineer"} will now be with you ${window}. Reply if you won't be in.`;
    default:
      return undefined;
  }
}

/**
 * The same as a text: plain characters only (a curly quote, en dash or emoji
 * turns a text into 70-character segments and roughly triples its cost, as
 * Kanvas Academy found), and the business name first so it's clear who
 * it's from.
 */
export function smsText(body: string, businessName: string, optOut = false): string {
  const plain = body
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x0A\x20-\x7E£]/g, "");
  return `${businessName}: ${plain}${optOut ? " Reply STOP to opt out." : ""}`;
}
