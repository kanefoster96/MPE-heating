// The booking funnel: a tree of choices. Each step shows cards; picking one
// shows the next list, until a leaf, where the details form appears with
// the right prompt, button label and extras (the £50 fee note and the
// same-day tick for repairs). The chosen path is sent with the enquiry.

import type { EnquiryType } from "./enquiry";

export type FunnelIcon =
  | "boiler"
  | "service"
  | "newboiler"
  | "plumbing"
  | "electrics"
  | "landlord"
  | "building"
  | "question"
  | "tap"
  | "bath"
  | "radiator"
  | "leak"
  | "fusebox"
  | "plug"
  | "bulb"
  | "ev"
  | "oven"
  | "clipboard"
  | "calendar"
  | "alert";

export type FunnelLeaf = {
  // Mapped to the enquiry type the API already understands.
  type: EnquiryType;
  // Placeholder for the free-text field.
  prompt: string;
  cta: string;
  // Repairs: show the £50 call-out explainer and the same-day tick.
  fee?: boolean;
  sameDay?: boolean;
};

export type FunnelNode = {
  id: string;
  label: string;
  text: string;
  icon: FunnelIcon;
  // Either more choices, or a leaf that opens the details form.
  children?: FunnelNode[];
  leaf?: FunnelLeaf;
};

const describe = (what: string) => `Tell us a bit about ${what}: what's happening, roughly where you are, and when suits.`;

export const funnel: FunnelNode[] = [
  {
    id: "boilers",
    label: "Boilers & heating",
    text: "Repairs, annual services and new boilers.",
    icon: "boiler",
    children: [
      {
        id: "repair",
        label: "Repair",
        text: "Not working, losing pressure, noisy or showing a fault.",
        icon: "alert",
        leaf: {
          type: "repair",
          prompt: "What's the boiler doing? Fault codes, noises, no heat or hot water…",
          cta: "Book a same-day call-out",
          fee: true,
          sameDay: true,
        },
      },
      {
        id: "service",
        label: "Annual service",
        text: "From £79. Keeps your warranty valid.",
        icon: "service",
        leaf: {
          type: "service",
          prompt: "Boiler make and model if you know it, and when it was last serviced.",
          cta: "Book a service",
        },
      },
      {
        id: "new",
        label: "New boiler",
        text: "Free fixed-price quote, usually fitted in a day.",
        icon: "newboiler",
        leaf: {
          type: "quote",
          prompt: "Current boiler, roughly how many bedrooms and bathrooms, and anything you'd like changed.",
          cta: "Get a free quote",
        },
      },
      {
        id: "radiators",
        label: "Radiators & controls",
        text: "Cold radiators, thermostats, timers, smart controls.",
        icon: "radiator",
        leaf: {
          type: "other",
          prompt: describe("the radiators or controls"),
          cta: "Book a visit",
        },
      },
      {
        id: "boiler-other",
        label: "Not sure",
        text: "Describe it and we'll point you to the right engineer.",
        icon: "question",
        leaf: { type: "other", prompt: describe("the problem"), cta: "Send details" },
      },
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    text: "Leaks, taps, toilets, bathrooms and pipework.",
    icon: "plumbing",
    children: [
      {
        id: "leak",
        label: "Leak or burst pipe",
        text: "Dripping, pooling or no water. We prioritise these.",
        icon: "leak",
        leaf: {
          type: "other",
          prompt: "Where is the leak, how bad is it, and have you been able to turn the water off?",
          cta: "Book a plumber",
          sameDay: true,
        },
      },
      {
        id: "taps",
        label: "Taps, toilets & showers",
        text: "Replacements, repairs, low pressure, running toilets.",
        icon: "tap",
        leaf: { type: "other", prompt: describe("the tap, toilet or shower"), cta: "Book a plumber" },
      },
      {
        id: "bathroom",
        label: "Bathroom installation",
        text: "Full fits and refits, plumbed and finished.",
        icon: "bath",
        leaf: {
          type: "other",
          prompt: "What you'd like done, the size of the room, and when you're hoping to start.",
          cta: "Get a quote",
        },
      },
      {
        id: "pipework",
        label: "Pipework & cylinders",
        text: "Hot water cylinders, tanks, moving or replacing pipes.",
        icon: "radiator",
        leaf: { type: "other", prompt: describe("the pipework or cylinder"), cta: "Book a plumber" },
      },
      {
        id: "plumbing-other",
        label: "Something else",
        text: "Describe it and we'll take it from there.",
        icon: "question",
        leaf: { type: "other", prompt: describe("the job"), cta: "Send details" },
      },
    ],
  },
  {
    id: "electrics",
    label: "Electrics",
    text: "Fuse boards, rewires, EV chargers, faults.",
    icon: "electrics",
    children: [
      {
        id: "fault",
        label: "Fault or tripping",
        text: "Power cutting out, breakers tripping, burning smells.",
        icon: "alert",
        leaf: {
          type: "other",
          prompt: "What's tripping or not working, how often, and anything you've noticed (smells, buzzing, scorch marks).",
          cta: "Book an electrician",
          sameDay: true,
        },
      },
      {
        id: "fusebox",
        label: "Fuse board",
        text: "Consumer unit upgrades and replacements.",
        icon: "fusebox",
        leaf: { type: "other", prompt: describe("your current fuse board"), cta: "Get a quote" },
      },
      {
        id: "rewire",
        label: "Rewire or new circuits",
        text: "Full or partial rewires, extensions, kitchens.",
        icon: "plug",
        leaf: { type: "other", prompt: describe("the property and the work"), cta: "Get a quote" },
      },
      {
        id: "lighting",
        label: "Lights & sockets",
        text: "New fittings, extra sockets, outdoor lighting.",
        icon: "bulb",
        leaf: { type: "other", prompt: describe("what you'd like fitted"), cta: "Book an electrician" },
      },
      {
        id: "ev",
        label: "EV charger",
        text: "Home charger supply and installation.",
        icon: "ev",
        leaf: {
          type: "other",
          prompt: "Your car or charger if you have one in mind, where you park, and where the fuse board is.",
          cta: "Get a quote",
        },
      },
    ],
  },
  {
    id: "landlord",
    label: "Landlord certificates",
    text: "CP12 gas safety and EICR, with reminders.",
    icon: "landlord",
    children: [
      {
        id: "cp12",
        label: "Gas safety (CP12)",
        text: "Annual landlord gas safety certificate.",
        icon: "clipboard",
        leaf: { type: "other", prompt: "Property address, number of gas appliances, and when the current certificate runs out.", cta: "Book an inspection" },
      },
      {
        id: "eicr",
        label: "Electrical (EICR)",
        text: "Electrical installation condition report.",
        icon: "fusebox",
        leaf: { type: "other", prompt: "Property address, size, and when the current report runs out.", cta: "Book an inspection" },
      },
      {
        id: "both",
        label: "Both",
        text: "Gas and electrical in one visit where we can.",
        icon: "calendar",
        leaf: { type: "other", prompt: "Property address and when the current certificates run out.", cta: "Book an inspection" },
      },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    text: "Priority call-outs for businesses and landlords.",
    icon: "building",
    children: [
      {
        id: "commercial-breakdown",
        label: "Breakdown",
        text: "Something's stopped and it's affecting trading.",
        icon: "alert",
        leaf: {
          type: "commercial",
          prompt: "Type of premises, what's stopped working, and whether you're still able to trade.",
          cta: "Request a priority call-out",
          sameDay: true,
        },
      },
      {
        id: "commercial-boiler",
        label: "Commercial boiler or heating",
        text: "Repairs, servicing and installs.",
        icon: "boiler",
        leaf: { type: "commercial", prompt: describe("the premises and the system"), cta: "Get a commercial quote" },
      },
      {
        id: "catering",
        label: "Catering equipment",
        text: "Ovens, fryers, gas appliances.",
        icon: "oven",
        leaf: { type: "commercial", prompt: describe("the kitchen and the equipment"), cta: "Get a commercial quote" },
      },
      {
        id: "compliance",
        label: "Gas safety & EICR",
        text: "Inspections and certificates for compliance.",
        icon: "clipboard",
        leaf: { type: "commercial", prompt: "Premises, what needs certifying, and any deadline you're working to.", cta: "Book an inspection" },
      },
      {
        id: "contract",
        label: "Maintenance contract",
        text: "Scheduled maintenance with priority call-out.",
        icon: "calendar",
        leaf: { type: "commercial", prompt: "Premises, the equipment you'd like covered, and how many sites.", cta: "Get a commercial quote" },
      },
    ],
  },
  {
    id: "other",
    label: "Something else",
    text: "Not sure where it fits? Tell us and we'll sort it.",
    icon: "question",
    leaf: { type: "other", prompt: "Tell us what you need and we'll point you to the right engineer.", cta: "Send message" },
  },
];

// Walk the tree by ids. Returns the nodes along the path, or null if any
// id doesn't exist at its level.
export function resolvePath(ids: string[]): FunnelNode[] | null {
  const out: FunnelNode[] = [];
  let level: FunnelNode[] | undefined = funnel;
  for (const id of ids) {
    const node: FunnelNode | undefined = level?.find((n) => n.id === id);
    if (!node) return null;
    out.push(node);
    level = node.children;
  }
  return out;
}

// Every path that ends in a leaf, for tests and the sitemap of deep links.
export function allLeafPaths(nodes: FunnelNode[] = funnel, prefix: string[] = []): string[][] {
  return nodes.flatMap((n) => {
    const here = [...prefix, n.id];
    return n.leaf ? [here] : allLeafPaths(n.children ?? [], here);
  });
}

export function bookHref(ids: string[], extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (ids.length) params.set("path", ids.join("."));
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `/book?${q}` : "/book";
}
