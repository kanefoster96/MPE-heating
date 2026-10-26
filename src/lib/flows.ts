// The dedicated booking forms: one step per screen, tap a card and the next
// step shows, contact details last. Each flow is plain data here; the
// StepFlow component renders any of them. Answers go in the enquiry email
// as "question: answer" lines.

import type { TwoTone } from "./content";
import type { EnquiryType } from "./enquiry";
import type { FunnelIcon } from "./funnel";

export type FlowChoice = { id: string; label: string; text?: string; icon?: FunnelIcon };

export type FlowStep =
  // `recap` is the short label in the summary and the enquiry email.
  | { kind: "choice"; id: string; recap: string; question: string; help?: string; choices: FlowChoice[] }
  | { kind: "text"; id: string; recap: string; question: string; help?: string; placeholder: string; minLength: number }
  | { kind: "postcode"; id: "postcode"; question: string; help?: string }
  // Optional photos, sent straight from the phone to storage
  // (api/uploads/booking-photo) and attached to the job. Only shown where
  // uploads can work (StepFlow), and always skippable.
  | { kind: "photos"; id: "photos"; question: string; help?: string; max: number }
  // A day in the next two weeks, then morning, afternoon or any time
  // (components/DayPartPicker.tsx). Saved as a request on the team's schedule.
  | { kind: "when"; id: "when"; recap: string; question: string; help?: string; fromToday?: boolean }
  | {
      kind: "contact";
      id: "contact";
      question: string;
      help?: string;
      name: boolean; // ask for a name
      submit: string;
      sameDay?: boolean; // show the same-day tick
    };

export type FlowKey = "callout" | "newBoiler" | "service" | "plan";

export type Flow = {
  key: FlowKey;
  type: EnquiryType;
  // Goes in the email subject and the "what you asked for" line.
  label: string;
  eyebrow: string;
  title: TwoTone;
  subtitle: string;
  // Show the £50 call-out explainer on the first step.
  fee?: boolean;
  steps: FlowStep[];
  thanks: { title: TwoTone; text: string };
};

const postcode: FlowStep = {
  kind: "postcode",
  id: "postcode",
  question: "What's your postcode?",
  help: "So we know where we're coming to.",
};

const photos = (help: string): FlowStep => ({
  kind: "photos",
  id: "photos",
  question: "Got a photo? (optional)",
  help,
  max: 5,
});

const boilerMake: FlowStep = {
  kind: "choice",
  id: "make",
  recap: "Boiler make",
  question: "What make is your boiler?",
  help: "It's usually on the front panel.",
  choices: [
    { id: "worcester", label: "Worcester Bosch", icon: "boiler" },
    { id: "vaillant", label: "Vaillant", icon: "boiler" },
    { id: "baxi", label: "Baxi", icon: "boiler" },
    { id: "ideal", label: "Ideal", icon: "boiler" },
    { id: "glowworm", label: "Glow-worm", icon: "boiler" },
    { id: "other", label: "Other, or not sure", icon: "question" },
  ],
};

export const flows: Record<FlowKey, Flow> = {
  callout: {
    key: "callout",
    type: "repair",
    label: "Boiler call-out",
    eyebrow: "Boiler call-out",
    title: { lead: "Boiler broken down?", em: "Book a call-out." },
    subtitle: "A few quick steps. £50 call-out, taken off your repair bill if you go ahead.",
    fee: true,
    steps: [
      {
        kind: "choice",
        id: "issue",
        recap: "Problem",
        question: "What's the boiler doing?",
        choices: [
          { id: "nothing", label: "No heating or hot water", icon: "alert" },
          { id: "no-heat", label: "No heating", icon: "radiator" },
          { id: "no-water", label: "No hot water", icon: "tap" },
          { id: "pressure", label: "Losing pressure", icon: "boiler" },
          { id: "leak", label: "Leaking", icon: "leak" },
          { id: "code", label: "Error code or noises", icon: "question" },
        ],
      },
      {
        kind: "text",
        id: "description",
        recap: "Details",
        question: "Describe it in a sentence",
        help: "Fault codes, noises, when it started. Whatever you've noticed.",
        placeholder: "E.g. error code F28, no heating since this morning.",
        minLength: 10,
      },
      photos("The boiler, the error code on its display, or where it is. It helps us bring the right parts."),
      postcode,
      {
        kind: "when",
        id: "when",
        recap: "Best time",
        question: "When suits you?",
        help: "We'll confirm a time with you before anyone sets off.",
        fromToday: true,
      },
      {
        kind: "contact",
        id: "contact",
        question: "Where should we confirm your call-out?",
        help: "We'll be in touch to confirm a time before anyone sets off.",
        name: false,
        submit: "Book my call-out",
        sameDay: true,
      },
    ],
    thanks: {
      title: { lead: "Thanks.", em: "Your call-out request is in." },
      text: "We'll be in touch to confirm a time, and agree the repair price with you before any work starts.",
    },
  },

  newBoiler: {
    key: "newBoiler",
    type: "quote",
    label: "New boiler quote",
    eyebrow: "New boilers",
    title: { lead: "A new boiler.", em: "Free fixed-price quote." },
    subtitle: "A few taps, then where to send your quote. No obligation.",
    steps: [
      {
        kind: "choice",
        id: "need",
        recap: "Need",
        question: "What do you need?",
        choices: [
          { id: "replace", label: "Replace my boiler", icon: "newboiler" },
          { id: "broken", label: "Mine's broken, it may need replacing", icon: "alert" },
          { id: "move", label: "Move or upgrade my system", icon: "radiator" },
          { id: "unsure", label: "Not sure yet", icon: "question" },
        ],
      },
      {
        kind: "choice",
        id: "current",
        recap: "Current boiler",
        question: "What boiler do you have now?",
        choices: [
          { id: "combi", label: "Combi", text: "No hot water tank", icon: "boiler" },
          { id: "system", label: "System", text: "Hot water cylinder, no loft tanks", icon: "boiler" },
          { id: "regular", label: "Regular", text: "Cylinder and tanks in the loft", icon: "boiler" },
          { id: "unsure", label: "Not sure", icon: "question" },
        ],
      },
      {
        kind: "choice",
        id: "fuel",
        recap: "Gas supply",
        question: "What's your current gas supply?",
        choices: [
          { id: "mains", label: "Mains gas" },
          { id: "lpg", label: "LPG (bottled or tank)" },
          { id: "oil", label: "Oil" },
          { id: "none", label: "No gas supply" },
          { id: "unsure", label: "Not sure" },
        ],
      },
      {
        kind: "choice",
        id: "bedrooms",
        recap: "Bedrooms",
        question: "How many bedrooms?",
        help: "It helps us size the boiler.",
        choices: [
          { id: "1-2", label: "1 or 2" },
          { id: "3", label: "3" },
          { id: "4", label: "4" },
          { id: "5+", label: "5 or more" },
        ],
      },
      {
        kind: "choice",
        id: "budget",
        recap: "Budget",
        question: "What's your budget?",
        help: "Just a guide, so the quote fits.",
        choices: [
          { id: "under-2k", label: "Under £2,000" },
          { id: "2-3k", label: "£2,000 to £3,000" },
          { id: "3-4k", label: "£3,000 to £4,000" },
          { id: "4k+", label: "Over £4,000" },
          { id: "unsure", label: "Not sure yet" },
        ],
      },
      {
        kind: "choice",
        id: "when",
        recap: "Timing",
        question: "When do you need it?",
        choices: [
          { id: "asap", label: "As soon as possible" },
          { id: "month", label: "Within a month" },
          { id: "months", label: "In the next few months" },
          { id: "prices", label: "Just getting prices" },
        ],
      },
      photos("Your boiler and where it is. It helps us with your quote."),
      postcode,
      {
        kind: "contact",
        id: "contact",
        question: "Where should we send your quote?",
        help: "Free and fixed-price. No obligation to go ahead.",
        name: true,
        submit: "Get my free quote",
      },
    ],
    thanks: {
      title: { lead: "Thanks.", em: "Your quote request is in." },
      text: "We'll be in touch about your free fixed-price quote, and arrange a quick look at your home if we need one.",
    },
  },

  service: {
    key: "service",
    type: "service",
    label: "Boiler service",
    eyebrow: "Servicing",
    title: { lead: "Annual service.", em: "From £79." },
    subtitle: "About 45 minutes, and it keeps your boiler warranty valid.",
    steps: [
      boilerMake,
      {
        kind: "choice",
        id: "last",
        recap: "Last service",
        question: "When was it last serviced?",
        choices: [
          { id: "year", label: "In the last year", icon: "calendar" },
          { id: "over", label: "Over a year ago", icon: "calendar" },
          { id: "never", label: "Never, or not sure", icon: "question" },
        ],
      },
      {
        kind: "when",
        id: "when",
        recap: "Best time",
        question: "When suits you?",
        help: "We'll confirm the exact day and time with you.",
      },
      postcode,
      {
        kind: "contact",
        id: "contact",
        question: "Where should we confirm your service?",
        name: true,
        submit: "Book my service",
      },
    ],
    thanks: {
      title: { lead: "Thanks.", em: "Your service request is in." },
      text: "We'll be in touch to confirm a day and time, with the price agreed before we arrive.",
    },
  },

  plan: {
    key: "plan",
    type: "plan",
    label: "Maintenance plan",
    eyebrow: "Maintenance plan",
    title: { lead: "Maintenance plan.", em: "Call-outs and your service, covered." },
    subtitle: "Free call-outs all year round, and a free yearly service.",
    steps: [
      {
        kind: "choice",
        id: "who",
        recap: "For",
        question: "Who's the plan for?",
        choices: [
          { id: "home", label: "My home", icon: "boiler" },
          { id: "rental", label: "A property I let", icon: "landlord" },
          { id: "business", label: "My business", icon: "building" },
        ],
      },
      {
        kind: "choice",
        id: "age",
        recap: "Boiler age",
        question: "How old is your boiler?",
        choices: [
          { id: "under-5", label: "Under 5 years" },
          { id: "5-10", label: "5 to 10 years" },
          { id: "over-10", label: "Over 10 years" },
          { id: "unsure", label: "Not sure" },
        ],
      },
      boilerMake,
      postcode,
      {
        kind: "contact",
        id: "contact",
        question: "Where should we send the plan details?",
        help: "We'll send the price and what's covered. No obligation.",
        name: true,
        submit: "Send me the plan details",
      },
    ],
    thanks: {
      title: { lead: "Thanks.", em: "Plan details on their way." },
      text: "We'll be in touch with the price and everything the plan covers.",
    },
  },
};

// Where each flow lives.
export const flowHref: Record<FlowKey, string> = {
  callout: "/emergency",
  newBoiler: "/book/new-boiler",
  service: "/book/service",
  plan: "/book/plan",
};
