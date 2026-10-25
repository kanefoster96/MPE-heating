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
  | "service_due";

export type VisitFacts = {
  kind: AppointmentKind;
  day: string;
  start: number;
  end: number;
  part?: Part | null;
  address?: string | null;
  postcode?: string | null;
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

const HEADLINE: Record<NoticeType, (v: VisitFacts) => string> = {
  booked: (v) => `You're booked in for your ${kindName(v.kind)}`,
  moved: (v) => `Your ${kindName(v.kind)} has moved`,
  cancelled: (v) => `Your ${kindName(v.kind)} is cancelled`,
  reminder: (v) => `See you tomorrow for your ${kindName(v.kind)}`,
  requested: (v) => `We've got your ${kindName(v.kind)} request`,
  hour: (v) => `Confirming today's ${kindName(v.kind)}`,
  missed: () => `Sorry we missed you`,
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
  opts: { link?: string; phone: string; name?: string | null; engineer?: string | null; bookLink?: string },
): string {
  const hi = opts.name ? `Hi ${opts.name.split(" ")[0]}, ` : "";
  const where = [v.address, v.postcode].filter(Boolean).join(", ");
  const cantMake = `If you can't make it, let us know${opts.link ? `: ${opts.link}` : ` on ${opts.phone}`}`;
  switch (type) {
    case "booked":
      return `${hi}you're booked in for your ${kindName(v.kind)} on ${whenLine(v)}${where ? ` at ${where}` : ""}. ${cantMake}`;
    case "moved":
      return `${hi}your ${kindName(v.kind)} has moved to ${whenLine(v)}${where ? ` at ${where}` : ""}. ${cantMake}`;
    case "cancelled":
      return `${hi}your ${kindName(v.kind)} on ${longDate(v.day)} is cancelled. If you'd still like a visit, just reply or call us on ${opts.phone}.`;
    case "reminder":
      return `${hi}a reminder that we're with you tomorrow for your ${kindName(v.kind)}, ${whenLine(v).replace(/^[^,]+, /, "")}. ${cantMake}`;
    case "hour":
      // The Academy's hour-before text: a named person expected at the
      // door, and nothing to do. No way out offered, just the number.
      return `${hi}just confirming ${opts.engineer ? `${opts.engineer} from MPE` : "our engineer"} will be with you today between ${windowLabel(v.start, v.end).replace("–", " and ")} for your ${kindName(v.kind)}. If anything's changed, call ${opts.phone}.`;
    case "missed":
      return `${hi}we called round for your ${kindName(v.kind)} on ${longDate(v.day)} but couldn't get in. No problem, pick another time that suits${opts.link ? `: ${opts.link}` : ` and call us on ${opts.phone}`}`;
    case "service_due":
      return `${hi}it's nearly a year since your boiler ${v.kind === "install" ? "was fitted" : "was last serviced"}, so its annual service is due. A yearly service keeps it safe and its warranty valid. Book a time that suits${opts.bookLink ? `: ${opts.bookLink}` : ` by calling ${opts.phone}`}`;
    case "requested":
      return `${hi}thanks, we've got your request for a ${kindName(v.kind)} on ${requestedWhen(v.day, v.part)}. We'll be in touch to confirm the time${opts.link ? `: ${opts.link}` : "."}`;
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
