// Central place for editable site copy & business details.
// Swap placeholder values (phone, Gas Safe number, reviews) for the real thing before launch.

import type { ContentBlock } from "./richContent";

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
  region: "North East England",
  areasList,
  areas: `We operate across all areas in the North East, including ${joinWithAnd(areasList)}.`,
};

export type PromoMessage = { text: string; tone?: "cold" };

// Rotates in the promo banner, one message every 5s. The first message stays
// fixed as the lead-in; the rest cycle after it. tone: "cold" swaps the
// banner to a blue "boiler's out" treatment instead of the default yellow.
export const promoMessages: PromoMessage[] = [
  { text: "£50 call-out — 100% comes off your bill when we fix it." },
  { text: "No heating? Engineers out the same day.", tone: "cold" },
  { text: "Every repair guaranteed for 90 days." },
  { text: "New boiler? Free fixed-price quote, usually fitted in a day." },
  { text: "Gas Safe engineers, price agreed before we start." },
];

// Hero copy is built on the value equation: dream outcome + likelihood it
// works, minus time delay and effort. Headline = outcome + speed. Subline
// = how little the customer has to do, and why it'll work. Ticks = the
// risk-reversal stack. Every claim here must be one MPE can actually keep.
export const hero = {
  // Dream outcome + time delay, in the customer's words.
  headline: "Heating and hot water back the same day",
  // Effort (we come to you), sacrifice (price agreed first), likelihood
  // (Gas Safe, one visit).
  subline:
    "A Gas Safe engineer comes to you anywhere in the North East, agrees the price before starting, and fixes most boilers in one visit.",
  cta: "Book a same-day visit",
  // White overlay copy shown beside the boiler photo, above the main card
  // (mobile and tablet only). question is the italic lead-in (paired with
  // a pulsing red dot), answer is the bold follow-up line. No button here
  // on purpose: the card's orange CTA is the only call to action.
  imageCallout: {
    question: "Boiler flashing red?",
    answer: "Emergency engineers out today.",
  },
  // Placeholder figure — swap for the real same-day fix rate once we have
  // the numbers to back it. value/label render as one line; explainer is
  // the pop-up text behind the info icon next to it.
  sameDayStat: {
    value: "90%",
    label: "of boilers fixed same-day",
    explainer:
      "Different boilers use different parts, so we can't promise a fix on the spot every time. But we carry the most common parts and faults for the most popular brands, so most jobs are done in one visit. On the rare occasion we can't finish it same-day, we'll reschedule your repair — usually within 24 hours.",
  },
  // Risk-reversal stack: money, surprises, and "what if it breaks again".
  ticks: [
    "£50 call-out, 100% off your bill when fixed",
    "Price agreed before we start",
    "90-day guarantee on every repair",
  ],
};

export const accreditations = ["Gas Safe Register", "TrustATrader", "City & Guilds"];

// Boiler manufacturers whose units MPE installs and services — shown as a
// wordmark marquee under the hero. Swap for real logo lockups if/when supplied.
export const boilerBrands = ["Worcester Bosch", "Vaillant", "Baxi", "Ideal", "Glow-worm"];

export type ServiceCard = {
  id: string;
  eyebrow: string;
  headline: string;
  line: string;
  cta: string;
  tone: "orange" | "grey" | "grey-green";
  icon: "boiler" | "service" | "newboiler" | "plumbing" | "electrics" | "landlord";
};

export const services: ServiceCard[] = [
  {
    id: "repair",
    eyebrow: "Boiler Repair",
    headline: "Heating back on the same day",
    line: "£50 call-out, 100% off your bill when we fix it. Guaranteed 90 days.",
    cta: "Book a repair",
    tone: "orange",
    icon: "boiler",
  },
  {
    id: "servicing",
    eyebrow: "Boiler Servicing",
    headline: "Annual service from £79",
    line: "45 minutes. Warranty kept valid, and we remind you next year.",
    cta: "Book a service",
    tone: "grey",
    icon: "service",
  },
  {
    id: "new-boilers",
    eyebrow: "New Boilers",
    headline: "New boiler, usually fitted in a day",
    line: "Free fixed-price quote. Old boiler taken away.",
    cta: "Get a free quote",
    tone: "grey-green",
    icon: "newboiler",
  },
  {
    id: "plumbing",
    eyebrow: "Plumbing",
    headline: "Leaks, taps, bathrooms and pipework",
    line: "Small jobs to full installs, price agreed first.",
    cta: "Book a plumber",
    tone: "grey",
    icon: "plumbing",
  },
  {
    id: "electrics",
    eyebrow: "Electrics",
    headline: "Fuse boards, rewires, EV chargers",
    line: "Part P certified, fully tested.",
    cta: "Book an electrician",
    tone: "grey",
    icon: "electrics",
  },
  {
    id: "landlords",
    eyebrow: "Landlords",
    headline: "Gas safety and electrical certificates",
    line: "CP12 and EICR, with a reminder before they expire.",
    cta: "Get certified",
    tone: "grey",
    icon: "landlord",
  },
];

// Full version for a future About page/section. whyMpeIntro below is the
// condensed version used as a subline on the homepage today.
export const about = {
  text: "MPE is a family-run gas, heating, plumbing and electrical firm covering the North East. The way we work is simple: you get the price before anything starts, an engineer the same day when it's urgent, and a 90-day guarantee on every repair. No pressure and no upselling. Our reputation is built on the customers who call us back and recommend us to their neighbours.",
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
      "Boiler repairs — same-day where we can, £50 call-out refunded when we fix it, 90-day guarantee",
      "Boiler servicing — from £79, around 45 minutes, keeps your warranty valid",
      "New boiler installations — free fixed-price quote, usually fitted in a day",
      "Plumbing and electrics — leaks, taps, bathrooms, fuse boards, rewires, EV chargers",
      "Commercial gas, catering equipment and compliance certificates, with priority call-outs",
    ],
  },
  { type: "h2", text: "How we work" },
  {
    type: "p",
    text: "You hear the price before any work starts, and nothing happens until you've agreed it. We diagnose honestly and quote fairly. Every repair is guaranteed for 90 days: if the same fault comes back, we return and put it right at no extra cost.",
  },
];

export const whyMpeIntro =
  "A family-run North East firm. You get the price before we start, an engineer the same day when it's urgent, and a 90-day guarantee on the work.";

export const whyMpe = [
  {
    icon: "price" as const,
    title: "Price before we start",
    text: "You approve the cost before any work begins. No surprises on the bill.",
  },
  {
    icon: "clock" as const,
    title: "Out the same day",
    text: "No heat or hot water? You go to the front of the queue.",
  },
  {
    icon: "check" as const,
    title: "Fixed for good",
    text: "Same fault back within 90 days? We return and fix it free.",
  },
];

export const howItWorks = [
  {
    number: 1,
    title: "Tell us what's wrong",
    text: "Two minutes online or on WhatsApp. You pick the time that suits.",
    icon: "form" as const,
  },
  {
    number: 2,
    title: "Your engineer arrives",
    text: "On time, with ID, and common parts on the van so most jobs finish in one visit.",
    icon: "doorstep" as const,
  },
  {
    number: 3,
    title: "You approve the price, we fix it",
    text: "Nothing starts until you've agreed the cost. Then it's fixed, tested and guaranteed for 90 days.",
    icon: "wrench" as const,
  },
];

export const guarantee = {
  title: "The 90-day fixed-for-good guarantee",
  text: "If the same fault comes back within 90 days of our repair, we return and put it right at no extra cost. No arguing, no small print.",
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

export const reviewSummary = {
  rating: "4.9",
  count: "480",
};

export type FaqItem = { q: string; a: string };

export const faqs: { homes: FaqItem[]; commercial: FaqItem[] } = {
  homes: [
    {
      q: "How quickly can you get to me?",
      a: "Most domestic repairs are seen the same day if you book before midday. For no heat or no hot water we prioritise you — just call and let us know it's urgent.",
    },
    {
      q: "How much is the call-out?",
      a: "£50 — and if you go ahead with the repair, 100% of that comes off your final bill, so you're never charged the call-out and the full price. You only end up paying the £50 on its own if you get the diagnosis and decide not to proceed.",
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
      q: "What's covered by the 90-day guarantee?",
      a: "Any repair we carry out is guaranteed for 90 days. If the same fault reoccurs in that time, we'll come back and fix it at no extra cost.",
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

export const commercial = {
  label: "Run a business?",
  headline: "Commercial gas and catering cover, with priority call-outs when downtime costs you",
  cta: "See commercial cover",
};

// Icon keys shared by every service sub-page's feature grid — mapped to
// actual icon components in src/lib/featureIcons.tsx, not here, so this
// file stays free of any component/JSX dependency.
export type FeatureIcon =
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
  headline: string;
  subline: string;
  cta: string;
  ticks: string[];
  features: { icon: FeatureIcon; title: string; text: string }[];
  checklistTitle: string;
  checklistItems: string[];
};

export const boilerRepairPage: ServicePage = {
  slug: "boiler-repair",
  navLabel: "Boiler repair",
  icon: "boiler",
  eyebrow: "Boiler Repair",
  headline: "Boiler fixed the same day, at a price you agreed first",
  subline:
    "Tell us what's wrong and a Gas Safe engineer comes to you anywhere in the North East, usually the same day. Most faults are fixed in one visit, and every repair is guaranteed for 90 days.",
  cta: "Book a same-day repair",
  ticks: ["£50 call-out, 100% off your bill when fixed", "Price agreed before we start", "90-day guarantee"],
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
      title: "90-day guarantee",
      text: "If the same fault comes back within 90 days, we'll return and put it right at no extra cost.",
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
  headline: "From £79: 45 minutes that keeps your warranty valid and your home safe",
  subline:
    "A Gas Safe engineer checks, cleans and tests your boiler, gives you a written report, and reminds you when the next one is due. Skip it and most manufacturers void your warranty.",
  cta: "Book a service",
  ticks: ["From £79, price fixed before we arrive", "Around 45 minutes", "Reminder every year"],
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
  headline: "A new boiler, usually fitted in a day, at a fixed price",
  subline:
    "Free, no-obligation quote on all major brands, fitted by a Gas Safe engineer anywhere in the North East. We take the old boiler away, register the warranty and handle building control, so there's nothing for you to chase.",
  cta: "Get a free fixed-price quote",
  ticks: ["Free, no-obligation quote", "Fixed price, nothing added", "Usually fitted in a day"],
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
  headline: "Commercial gas, heating and electrics, sorted before downtime costs you",
  subline:
    "Catering equipment, commercial boilers, gas appliances and EICR and gas safety certificates for North East businesses. Breakdowns that stop you trading are prioritised, most sites are seen within 24 hours, and we can invoice on account.",
  cta: "Get a commercial quote",
  ticks: ["Priority call-outs, most sites within 24 hours", "Maintenance contracts available", "Account invoicing"],
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
  headline: "Straight answers, no small print",
  subline:
    "What the call-out costs, how fast we can get to you, and exactly what the 90-day guarantee covers. For homes and businesses.",
  cta: "Ask us anything",
  ticks: ["£50 call-out, 100% off your bill when fixed", "Price agreed before we start", "90-day guarantee"],
};

export const finalCta = {
  headline: "Boiler playing up? We can be out today.",
  cta: "Book a same-day visit",
};

export const footerLinks: { label: string; href?: string }[] = [
  { label: "About", href: "/about" },
  { label: "Commercial", href: "/commercial" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
