import { KIND_LABEL, PART_LABEL, longDate, windowLabel, type AppointmentKind, type Part } from "@/lib/day-plan";

/**
 * What a customer is told about a visit, as plain words: the chat message,
 * the text and the email all start from here, and the team's add-visit form
 * shows the same words as a preview. No DB or server imports.
 */

export type NoticeType = "booked" | "moved" | "cancelled" | "reminder" | "requested";

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
};

/** The email subject and the first line everywhere. */
export function noticeHeadline(type: NoticeType, v: VisitFacts): string {
  return HEADLINE[type](v);
}

/**
 * The message itself. `link` is the customer's page for this visit, where
 * they can see it, add it to their calendar or ask for another time.
 */
export function noticeBody(type: NoticeType, v: VisitFacts, opts: { link?: string; phone: string; name?: string | null }): string {
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
    case "requested":
      return `${hi}thanks, we've got your request for a ${kindName(v.kind)} on ${requestedWhen(v.day, v.part)}. We'll be in touch to confirm the time${opts.link ? `: ${opts.link}` : "."}`;
  }
}
