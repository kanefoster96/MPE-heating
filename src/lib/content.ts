// Central place for editable site copy & business details.
// Swap placeholder values (phone, Gas Safe number, reviews) for the real thing before launch.

import type { ContentBlock } from "./richContent";
import type { EnquiryType } from "./enquiry";

// Single source of truth for the towns served — backs both the prose
// sentence below (business.areas) and the structured areaServed list used
// in JSON-LD (see src/lib/seo.ts), so they can never drift apart.
const areasList = [
  "Newcastle",
  "Gateshead",
  "Gosforth",
  "Whitley Bay",
  "Wallsend",
  "South Shields",
  "Cramlington",
  "Ashington",
  "Sunderland",
  "Blyth",
  "Morpeth",
  "West Boldon",
  "Washington",
  "Redcar",
];

function joinWithAnd(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const business = {
  name: "MPE",
  fullName: "MPE Gas, Heating, Plumbing & Electrics",
  phoneDisplay: "07448 628 101",
  phoneHref: "tel:07448628101",
  whatsappHref: "https://wa.me/447448628101",
  email: "fergal@mpenortheast.co.uk",
  gasSafeNumber: "552052",
  base: "Whitley Bay",
  baseRegion: "Tyne and Wear",
  region: "North East England",
  areasList,
  areas: `We operate across all areas in the North East, including ${joinWithAnd(areasList)}.`,
};

// Headings across the site are two clauses: `lead` is plain navy, `em`
// carries the orange gradient. The gradient goes on the clause that sells
// (the outcome, the speed, the price), never on body copy or buttons.
export type TwoTone = { lead: string; em: string };

// Hero copy is built on the value equation: dream outcome + likelihood it
// works, minus time delay and effort. Every claim must be one MPE can keep.
export const hero = {
  // Thin banner under the nav: one line and a small pill.
  banner: { text: "Boiler broken down? Same-day call-outs.", cta: "Book now" },
  // Proof row above the headline: the marks we hold, then who we serve.
  // No invented numbers.
  proof: { lead: "Trusted by homes & businesses", sub: "in Whitley Bay and across the North East", rated: "Rated on TrustATrader" },
  status: "Same-day boiler repairs in Whitley Bay",
  // Dream outcome, then the time promise carries the gradient.
  headline: { lead: "Heating and hot water back.", em: "The same day." } satisfies TwoTone,
  // Effort (we come to you), sacrifice (price agreed first), likelihood
  // (Gas Safe, parts on the van), and the honest version of "same day".
  subline:
    "Boiler repairs in Whitley Bay and across the North East. A Gas Safe engineer comes out for a £50 call-out, agrees the price before any work starts, and fixes it the same day where we have the parts, or the next available day.",
  cta: "Book a same-day call-out",
  // Second action: everything else MPE does, via the service cards.
  servicesCta: "See our services",
  // Two quiet lines under the button, like "No card, no commitment."
  underButton: ["£50 call-out. Refunded in full when we do the repair.", "Decide not to go ahead and £50 is all you pay."],
};

// The £50 call-out, explained. Shown before every booking ask (hero,
// form, repair page) so nobody books without knowing the deal.
export const fee = {
  title: "The £50 call-out, explained",
  lines: [
    "£50 covers the visit and the diagnosis.",
    "Go ahead with the repair and the whole £50 comes off your bill.",
    "Decide not to, and £50 is all you pay.",
  ],
  short: "£50 call-out. Refunded in full when we do the repair.",
};

// The worry, and what we do about it. One card each, short.
export const problemFix = {
  heading: { lead: "Boiler broken down?", em: "Here's how we take the stress out." } satisfies TwoTone,
  items: [
    { icon: "clock" as const, worry: "No heating or hot water", fix: "Out the same day", text: "Fixed on the spot where we have the parts, or the next available day." },
    { icon: "van" as const, worry: "Waiting in for no-shows", fix: "A time you can rely on", text: "We ring to confirm and turn up when we said." },
    { icon: "price" as const, worry: "Not knowing the cost", fix: "Price agreed first", text: "You say yes before any work starts." },
    { icon: "card" as const, worry: "Paying twice", fix: "£50, refunded when we repair", text: "One charge, not a call-out plus the fix." },
  ],
};

export const accreditations = ["Gas Safe Register", "TrustATrader", "City & Guilds"];

// Boiler manufacturers whose units MPE installs and services — shown as a
// quiet static row under the hero (nothing loops on the page).
export const boilerBrands = ["Worcester Bosch", "Vaillant", "Baxi", "Ideal", "Glow-worm"];

// Every service MPE offers. Rendered as pills on the homepage (each
// linking to its page, or to the booking form for the ones without one)
// and as the offer catalogue in the LocalBusiness JSON-LD.
export type ServiceCard = {
  id: string;
  eyebrow: string;
  headline: string;
  line: string;
  href: string;
  icon: "boiler" | "service" | "newboiler" | "plumbing" | "electrics" | "landlord";
};

export const services: ServiceCard[] = [
  {
    id: "repair",
    eyebrow: "Boiler Repair",
    headline: "Heating back on the same day",
    line: "£50 call-out, 100% off your bill when we fix it. Guaranteed 3 months.",
    href: "/boiler-repair",
    icon: "boiler",
  },
  {
    id: "servicing",
    eyebrow: "Boiler Servicing",
    headline: "Annual service from £79",
    line: "45 minutes. Warranty kept valid, and we remind you next year.",
    href: "/servicing",
    icon: "service",
  },
  {
    id: "new-boilers",
    eyebrow: "New Boilers",
    headline: "New boiler, usually fitted in a day",
    line: "Free fixed-price quote. Old boiler taken away.",
    href: "/new-boilers",
    icon: "newboiler",
  },
  {
    id: "plumbing",
    eyebrow: "Plumbing",
    headline: "Leaks, taps, bathrooms and pipework",
    line: "Small jobs to full installs, price agreed first.",
    href: "/book?path=plumbing",
    icon: "plumbing",
  },
  {
    id: "electrics",
    eyebrow: "Electrics",
    headline: "Fuse boards, rewires, EV chargers",
    line: "Part P certified, fully tested.",
    href: "/book?path=electrics",
    icon: "electrics",
  },
  {
    id: "landlords",
    eyebrow: "Landlord Certificates",
    headline: "Gas safety and electrical certificates",
    line: "CP12 and EICR, with a reminder before they expire.",
    href: "/book?path=landlord",
    icon: "landlord",
  },
];

export const commercialPush = {
  eyebrow: "Run a business?",
  heading: { lead: "Priority call-outs for commercial.", em: "So downtime doesn't cost you." } satisfies TwoTone,
  text: "Catering equipment, commercial boilers, gas safety and EICR. Most sites seen within 24 hours, with account invoicing.",
  cta: "Book commercial",
  href: "/book?path=commercial",
  secondary: { label: "See commercial cover", href: "/commercial" },
};

// Full version for a future About page/section. whyMpeIntro below is the
// condensed version used as a subline on the homepage today.
export const about = {
  text: "MPE is a family-run gas, heating, plumbing and electrical firm covering the North East. The way we work is simple: you get the price before anything starts, an engineer the same day when it's urgent, and a 3-month guarantee on every repair. No pressure and no upselling. Our reputation is built on the customers who call us back and recommend us to their neighbours.",
};

// About page body — reuses about.text as the lead paragraph. Deliberately
// doesn't name a specific founder or claim "X years in business": the
// client asked earlier for copy that reads as a team rather than a single
// person, and we don't have a confirmed founding date to state as fact.
export const aboutPageContent: ContentBlock[] = [
  { type: "p", text: about.text },
  {
    type: "p",
    text: `We're Gas Safe registered (registration number ${business.gasSafeNumber}) and cover ${business.region} — see our full list of areas we cover for local detail on each.`,
  },
  { type: "h2", text: "What we do" },
  {
    type: "list",
    items: [
      "Boiler repairs — same-day where we can, £50 call-out refunded when we fix it, 3-month guarantee",
      "Boiler servicing — from £79, around 45 minutes, keeps your warranty valid",
      "New boiler installations — free fixed-price quote, usually fitted in a day",
      "Plumbing and electrics — leaks, taps, bathrooms, fuse boards, rewires, EV chargers",
      "Commercial gas, catering equipment and compliance certificates, with priority call-outs",
    ],
  },
  { type: "h2", text: "How we work" },
  {
    type: "p",
    text: "You hear the price before any work starts, and nothing happens until you've agreed it. We diagnose honestly and quote fairly. Every repair is guaranteed for 3 months: if the same fault comes back, we return and put it right at no extra cost.",
  },
];

// How it works, 1, 2, 3: three short steps, one line each.
export const howItWorks = {
  heading: { lead: "Booking takes two minutes.", em: "As easy as 1,\u00a02,\u00a03." } satisfies TwoTone,
  steps: [
    {
      number: 1,
      title: "Fill in the form",
      text: "Tell us what's wrong and when suits. Need someone today? Tick the box and you go to the front of the queue.",
    },
    {
      number: 2,
      title: "We come out for £50",
      text: "Your engineer finds the fault and agrees the repair price with you before any work starts.",
    },
    {
      number: 3,
      title: "Fixed, and the £50 comes off",
      text: "Same day where we have the parts, or the next available day. Guaranteed for 3 months.",
    },
  ],
};

// Four promise badges: a big short value and one line under it.
export const promises = {
  heading: { lead: "Your risk, removed.", em: "On every repair." } satisfies TwoTone,
  items: [
    { value: "£50", label: "call-out, refunded in full when we do the repair" },
    { value: "Price first", label: "agreed with you before any work starts" },
    { value: "Same day", label: "where we have the parts, or the next available day" },
    { value: "3 months", label: "guarantee: same fault back, we return free" },
  ],
  cta: "Book a same-day call-out",
  note: "Decide not to go ahead after the diagnosis and £50 is all you pay.",
};

export const guarantee = {
  title: "The 3-month fixed-for-good guarantee",
  text: "If the same fault comes back within 3 months of our repair, we return and put it right at no extra cost. No arguing, no small print.",
  pill: "We'll always confirm costs before any further work.",
};

export const reviews = [
  {
    quote:
      "The engineer who came out was brilliant — diagnosed the fault straight away and had the heating back on within the hour. Really fair price too.",
    name: "Sarah T.",
    date: "2 days ago",
  },
  {
    quote:
      "Turned up same day when our boiler packed in over the weekend. Professional, tidy, explained everything clearly.",
    name: "Mark H.",
    date: "1 week ago",
  },
  {
    quote:
      "Used MPE for our landlord gas certificate — quick to book, on time, and the certificate landed in my inbox that afternoon.",
    name: "Priya K.",
    date: "2 weeks ago",
  },
  {
    quote:
      "No pressure, no upselling, just a straightforward fix at a fair price. Would use again without a second thought.",
    name: "David W.",
    date: "3 weeks ago",
  },
];

export type FaqItem = { q: string; a: string };

export const faqs: { homes: FaqItem[]; commercial: FaqItem[] } = {
  homes: [
    {
      q: "How quickly can you get to me?",
      a: "Most domestic repairs are seen the same day if you book before midday. We fix on the spot where we have the parts on the van, otherwise we arrange the next available day to get you up and running again fast. No heat or hot water? Tick \"I need someone today\" when you book and you go to the front of the queue.",
    },
    {
      q: "How much is the call-out?",
      a: "£50 — and if you go ahead with the repair, 100% of that comes off your final bill, so you're never charged the call-out and the full price. You only end up paying the £50 on its own if you get the diagnosis and decide not to proceed.",
    },
    {
      q: "What if you can't fix it the same day?",
      a: "Most faults we fix on the spot because we carry the common parts on the van. If yours needs a part we don't have, we order it and book the next available day, and you don't pay a second call-out.",
    },
    {
      q: "What if I decide not to go ahead?",
      a: "Then the £50 call-out is all you pay. You'll have a diagnosis and a price in writing, with no pressure to use us for the repair.",
    },
    {
      q: "Which areas do you cover?",
      a: `We're based in Whitley Bay and cover the North East, including ${joinWithAnd(areasList)}. If you're nearby but not on that list, ask: we probably still come to you.`,
    },
    {
      q: "Do you give a price before starting work?",
      a: "Always. Once we've diagnosed the fault we'll agree the price with you before any repair work begins — no surprises on the invoice.",
    },
    {
      q: "Are your engineers Gas Safe registered?",
      a: `Yes, every engineer is Gas Safe registered (registration number ${business.gasSafeNumber}) and fully insured for domestic and commercial work.`,
    },
    {
      q: "What's covered by the 3-month guarantee?",
      a: "Any repair we carry out is guaranteed for 3 months. If the same fault reoccurs in that time, we'll come back and fix it at no extra cost.",
    },
  ],
  commercial: [
    {
      q: "Do you work with commercial premises?",
      a: "Yes — we service and repair commercial gas appliances, catering equipment and commercial boilers for offices, restaurants, salons and landlords.",
    },
    {
      q: "Can you set up a maintenance contract?",
      a: "Yes, we offer scheduled maintenance contracts for commercial boilers and catering equipment, with priority call-out included.",
    },
    {
      q: "Do you provide EICR and gas safety certificates for businesses?",
      a: "Yes, we carry out commercial EICRs, gas safety inspections and issue the relevant certification for compliance.",
    },
    {
      q: "What's your response time for commercial call-outs?",
      a: "We prioritise commercial breakdowns that affect trading — most sites are seen within 24 hours, sooner for urgent cases.",
    },
    {
      q: "Do you invoice businesses directly?",
      a: "Yes, we can set up account invoicing for commercial and landlord clients — get in touch to arrange this.",
    },
  ],
};

// Icon keys shared by every service sub-page's feature grid — mapped to
// actual icon components in src/lib/featureIcons.tsx, not here, so this
// file stays free of any component/JSX dependency.
export type FeatureIcon =
  | "card"
  | "van"
  | "price"
  | "clock"
  | "check"
  | "shield"
  | "gassafe"
  | "boiler"
  | "service"
  | "newboiler"
  | "plumbing"
  | "electrics"
  | "landlord"
  | "building"
  | "award";

export type ServicePage = {
  slug: string;
  navLabel: string;
  icon: FeatureIcon;
  eyebrow: string;
  // Two clauses: the second carries the gradient and is the one that sells.
  headline: TwoTone;
  // Plain-text version for <title>, meta description and JSON-LD.
  headlineText: string;
  status: string;
  subline: string;
  cta: string;
  enquiry: EnquiryType;
  // One sentence of reassurance under the ask. Not a list: the page's one
  // ticked list is the checklist further down.
  reassurance: string;
  features: { icon: FeatureIcon; title: string; text: string }[];
  checklistTitle: string;
  checklistItems: string[];
};

export const boilerRepairPage: ServicePage = {
  slug: "boiler-repair",
  navLabel: "Boiler repair",
  icon: "boiler",
  eyebrow: "Boiler Repair",
  headline: { lead: "Boiler fixed the same day.", em: "Price agreed first." },
  headlineText: "Boiler fixed the same day, price agreed first",
  status: "Same-day call-outs across the North East",
  subline:
    "Tell us what's wrong and a Gas Safe engineer comes out for a £50 call-out, refunded in full when we do the repair. Fixed the same day where we have the parts, or the next available day.",
  cta: "Book a same-day call-out",
  enquiry: "repair",
  reassurance: "£50 call-out, 100% off your bill when fixed. Every repair guaranteed for 3 months.",
  features: [
    {
      icon: "clock",
      title: "Out the same day",
      text: "No heat or hot water goes to the front of the queue. Most repairs are seen the same day you call.",
    },
    {
      icon: "price",
      title: "Price agreed first",
      text: "We diagnose the fault and agree the cost with you before any work starts. Nothing is added later.",
    },
    {
      icon: "gassafe",
      title: "Gas Safe registered",
      text: `Every engineer is Gas Safe registered (registration number ${business.gasSafeNumber}) and fully insured.`,
    },
    {
      icon: "check",
      title: "£50 call-out, refunded when fixed",
      text: "Not a hidden charge — 100% of it comes off your bill once we fix it. You only pay the £50 on its own if you decide not to proceed after the diagnosis.",
    },
    {
      icon: "shield",
      title: "3-month guarantee",
      text: "If the same fault comes back within 3 months, we'll return and put it right at no extra cost.",
    },
    {
      icon: "boiler",
      title: "All major brands, parts on the van",
      text: "Worcester Bosch, Vaillant, Baxi, Ideal, Glow-worm and more. We carry the common parts, so most jobs finish in one visit.",
    },
  ],
  checklistTitle: "Common boiler problems we fix",
  checklistItems: [
    "No heat or no hot water",
    "Boiler losing pressure",
    "Leaking or dripping boiler",
    "Strange banging or gurgling noises",
    "Pilot light won't stay lit",
    "Boiler locked out or showing a fault code",
    "Radiators not heating up properly",
    "Thermostat or timer not working",
  ],
};

export const servicingPage: ServicePage = {
  slug: "servicing",
  navLabel: "Servicing",
  icon: "service",
  eyebrow: "Boiler Servicing",
  headline: { lead: "Forty-five minutes a year.", em: "Warranty kept valid." },
  headlineText: "Annual boiler service from £79, warranty kept valid",
  status: "Annual services from £79",
  subline:
    "A Gas Safe engineer checks, cleans and tests your boiler, gives you a written report, and reminds you when the next one is due. Skip it and most manufacturers void your warranty.",
  cta: "Book a service",
  enquiry: "service",
  reassurance: "From £79, price fixed before we arrive. Written report, and a reminder when the next one is due.",
  features: [
    {
      icon: "shield",
      title: "Keeps your warranty valid",
      text: "Most manufacturers require an annual service to keep your boiler's warranty valid.",
    },
    {
      icon: "gassafe",
      title: "Full safety check",
      text: "We check for carbon monoxide risk, correct pressure, and safe operation throughout.",
    },
    {
      icon: "check",
      title: "Catches issues early",
      text: "A worn part spotted now is a small job. The same part failing in January is an emergency call-out.",
    },
    {
      icon: "price",
      title: "Fixed price",
      text: "From £79, agreed before we arrive — no surprises on the day.",
    },
    {
      icon: "service",
      title: "Full written report",
      text: "Everything we checked, in writing, so you've got it on record.",
    },
    {
      icon: "clock",
      title: "A reminder every year",
      text: "We'll get in touch when your next service is due, so you don't have to track it.",
    },
  ],
  checklistTitle: "What's included in a service",
  checklistItems: [
    "Visual inspection of the boiler and flue",
    "Case removed and internal components checked",
    "Gas pressure and burner checked",
    "Flue gas analysis (carbon monoxide check)",
    "Safety devices tested",
    "Condensate pipe checked for blockages",
    "Boiler pressure and controls checked",
    "Full report and Gas Safe certificate",
  ],
};

export const newBoilersPage: ServicePage = {
  slug: "new-boilers",
  navLabel: "New boilers",
  icon: "newboiler",
  eyebrow: "New Boilers",
  headline: { lead: "A new boiler at a fixed price.", em: "Usually fitted in a day." },
  headlineText: "New boiler at a fixed price, usually fitted in a day",
  status: "Free fixed-price quotes across the North East",
  subline:
    "Free, no-obligation quote on all major brands, fitted by a Gas Safe engineer anywhere in the North East. We take the old boiler away, register the warranty and handle building control, so there's nothing for you to chase.",
  cta: "Get a free fixed-price quote",
  enquiry: "quote",
  reassurance: "Free, no-obligation quote. Old boiler taken away, warranty registered, building control handled.",
  features: [
    {
      icon: "price",
      title: "Free, no-obligation quote",
      text: "We'll assess your home and give you a fixed price — no pressure to go ahead.",
    },
    {
      icon: "boiler",
      title: "All major brands",
      text: "Worcester Bosch, Vaillant, Baxi, Ideal, Glow-worm and more, fitted to manufacturer spec.",
    },
    {
      icon: "shield",
      title: "Manufacturer's warranty",
      text: "Every installation is registered so your manufacturer's warranty applies from day one.",
    },
    {
      icon: "check",
      title: "Old boiler removed",
      text: "We take away and dispose of your old boiler as part of the job.",
    },
    {
      icon: "gassafe",
      title: "Building regs handled",
      text: "We register the installation with Gas Safe and building control, so you don't have to.",
    },
    {
      icon: "clock",
      title: "Usually done in a day",
      text: "Most installations are completed in a single visit, with minimal disruption.",
    },
  ],
  checklistTitle: "Signs it might be time for a new boiler",
  checklistItems: [
    "Boiler is over 10-15 years old",
    "Repairs are becoming frequent or expensive",
    "Energy bills have crept up",
    "Boiler is no longer covered by a warranty",
    "Replacement parts are hard to find",
    "It's noisy, leaking, or needs frequent resetting",
  ],
};

export const commercialPage: ServicePage = {
  slug: "commercial",
  navLabel: "Commercial",
  icon: "building",
  eyebrow: "Commercial",
  headline: { lead: "Commercial gas, heating and electrics.", em: "Sorted before downtime costs you." },
  headlineText: "Commercial gas, heating and electrics, sorted before downtime costs you",
  status: "Priority call-outs, most sites within 24 hours",
  subline:
    "Catering equipment, commercial boilers, gas appliances and EICR and gas safety certificates for North East businesses. Breakdowns that stop you trading are prioritised, most sites are seen within 24 hours, and we can invoice on account.",
  cta: "Get a commercial quote",
  enquiry: "commercial",
  reassurance: "Breakdowns that stop you trading come first. Maintenance contracts and account invoicing available.",
  features: [
    {
      icon: "building",
      title: "Commercial gas & catering equipment",
      text: "Ovens, fryers, commercial boilers and gas appliances for offices, restaurants and salons.",
    },
    {
      icon: "shield",
      title: "Maintenance contracts",
      text: "Scheduled maintenance with priority call-out included, so breakdowns don't catch you out.",
    },
    {
      icon: "gassafe",
      title: "EICR & gas safety certificates",
      text: "Full commercial EICRs and gas safety inspections, with certification for compliance.",
    },
    {
      icon: "clock",
      title: "Fast response",
      text: "We prioritise breakdowns that affect trading — most sites are seen within 24 hours.",
    },
    {
      icon: "price",
      title: "Account invoicing available",
      text: "We can set up account invoicing for commercial and landlord clients.",
    },
    {
      icon: "check",
      title: "Landlord certificates",
      text: "CP12 gas safety and EICR certificates, with reminders before they expire.",
    },
  ],
  checklistTitle: "Commercial services we cover",
  checklistItems: [
    "Commercial boiler installation & repair",
    "Catering equipment servicing",
    "Gas safety inspections & CP12 certificates",
    "Commercial EICR & electrical testing",
    "Maintenance contracts with priority call-out",
    "Landlord gas & electrical compliance",
  ],
};

// Doesn't use the ServicePage type (no features/checklist) — the page
// itself reuses the existing Faq component for the actual content.
export const faqsPage = {
  eyebrow: "Questions",
  headline: { lead: "Straight answers.", em: "No small print." } satisfies TwoTone,
  headlineText: "Straight answers, no small print",
  status: "For homes and businesses",
  subline:
    "What the call-out costs, how fast we can get to you, and exactly what the 3-month guarantee covers.",
  cta: "Ask us anything",
  enquiry: "other" as EnquiryType,
  reassurance: "£50 call-out, 100% off your bill when fixed. Price agreed before we start.",
};

export const finalCta = {
  heading: { lead: "Boiler playing up?", em: "We can be out today." } satisfies TwoTone,
  cta: "Book a same-day call-out",
};

export const footerLinks: { label: string; href?: string }[] = [
  { label: "About", href: "/about" },
  { label: "Commercial", href: "/commercial" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
