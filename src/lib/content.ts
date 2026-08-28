// Central place for editable site copy & business details.
// Swap placeholder values (phone, Gas Safe number, reviews) for the real thing before launch.

export const business = {
  name: "MPE",
  fullName: "MPE Gas, Heating, Plumbing & Electrics",
  phoneDisplay: "07448 628 101",
  phoneHref: "tel:07448628101",
  whatsappHref: "https://wa.me/447448628101",
  email: "fergal@mpenortheast.co.uk",
  gasSafeNumber: "552052",
  areas:
    "We operate across all areas in the North East, including Newcastle, Gateshead, Gosforth, Whitley Bay, Wallsend, South Shields, Cramlington, Ashington, Sunderland, Blyth, Morpeth, West Boldon, Washington and Redcar.",
};

export type PromoMessage = { text: string; tone?: "cold" };

// Rotates in the promo banner, one message every 5s. The first message stays
// fixed as the lead-in; the rest cycle after it. tone: "cold" swaps the
// banner to a blue "boiler's out" treatment instead of the default yellow.
export const promoMessages: PromoMessage[] = [
  { text: "£50 call-out, deducted from your final bill." },
  { text: "Boiler broken down? Same-day response.", tone: "cold" },
  { text: "£50 call-out, refunded when we fix it." },
  { text: "Free, no-obligation quotes on new boilers." },
  { text: "Gas Safe engineers, price agreed before we start." },
];

export const hero = {
  label: "Boiler Repairs",
  // The outcome the customer gets.
  headline: "Hot water and heating, working again",
  // What MPE does for them to get there.
  subline:
    "Our engineers diagnose the fault, agree a fair price, and get it fixed — across the North East.",
  cta: "Book a visit",
  // White overlay copy shown beside the boiler photo, above the main card.
  // question is the italic lead-in (paired with a pulsing red dot), answer
  // is the bold follow-up line, emergencyCta is the secondary pill button
  // shown underneath.
  imageCallout: {
    question: "Boiler flashing red?",
    answer: "Book same-day response.",
    emergencyCta: "Request emergency callout",
  },
  ticks: [
    "Gas Safe registered",
    "£50 call-out refunded when fixed",
    "30-day guarantee",
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
    headline: "Same-day boiler repairs",
    line: "£50 call-out, taken off your bill.",
    cta: "Book a repair",
    tone: "orange",
    icon: "boiler",
  },
  {
    id: "servicing",
    eyebrow: "Boiler Servicing",
    headline: "Annual service from £79",
    line: "Keeps your warranty valid and your boiler safe.",
    cta: "Book a service",
    tone: "grey",
    icon: "service",
  },
  {
    id: "new-boilers",
    eyebrow: "New Boilers",
    headline: "New boiler supplied and fitted",
    line: "Fixed quote, no surprises.",
    cta: "Get a quote",
    tone: "grey-green",
    icon: "newboiler",
  },
  {
    id: "plumbing",
    eyebrow: "Plumbing",
    headline: "Leaks, taps, bathrooms and pipework",
    line: "Small jobs to full installs.",
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
    line: "CP12 and EICR, reminders every year.",
    cta: "Get certified",
    tone: "grey",
    icon: "landlord",
  },
];

// Full version for a future About page/section. whyMpeIntro below is the
// condensed version used as a subline on the homepage today.
export const about = {
  text: "As a family-run business, we take pride in delivering honest, reliable, and professional services across electrical, plumbing, and gas works. We are committed to providing high-quality workmanship with a straightforward, no-nonsense approach and competitive pricing. Customer satisfaction is at the heart of what we do, and our reputation is built on the trust and positive feedback of those we've proudly served.",
};

export const whyMpeIntro =
  "A family-run business built on honest, reliable work — straightforward pricing, no-nonsense service, and a reputation built on the customers we've proudly served.";

export const whyMpe = [
  {
    icon: "price" as const,
    title: "Clear pricing",
    text: "You'll know the cost before we start.",
  },
  {
    icon: "clock" as const,
    title: "Same-day response",
    text: "Heating and hot water can't wait.",
  },
  {
    icon: "check" as const,
    title: "Done right",
    text: "30-day guarantee on every repair.",
  },
];

export const howItWorks = [
  {
    number: 1,
    title: "Book online or on WhatsApp",
    text: "Tell us what's wrong in a couple of minutes and pick a time that suits.",
    icon: "form" as const,
  },
  {
    number: 2,
    title: "Your engineer arrives",
    text: "Fully kitted out and on time, with ID and a smile.",
    icon: "doorstep" as const,
  },
  {
    number: 3,
    title: "Fixed, price agreed first",
    text: "No surprises on the invoice — you approve the cost before any work starts.",
    icon: "wrench" as const,
  },
];

export const guarantee = {
  title: "30-day work guarantee",
  text: "If anything we've repaired plays up again within 30 days, we'll come back and put it right at no extra cost.",
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
      a: "£50, which is deducted from your final bill if you go ahead with the repair. If you decide not to proceed, you only pay the £50 call-out.",
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
      q: "What's covered by the 30-day guarantee?",
      a: "Any repair we carry out is guaranteed for 30 days. If the same fault reoccurs in that time, we'll come back and fix it at no extra cost.",
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
  headline: "Commercial gas, catering equipment and maintenance contracts",
  cta: "Commercial services",
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
  headline: "Boiler fixed, fast — with a price you agreed first",
  subline:
    "Same-day response where we can, Gas Safe engineers, and a 30-day guarantee on every repair we carry out.",
  cta: "Book a repair",
  ticks: ["Gas Safe registered", "£50 call-out refunded when fixed", "30-day guarantee"],
  features: [
    {
      icon: "clock",
      title: "Same-day response",
      text: "Heating and hot water can't wait — most repairs are seen the same day.",
    },
    {
      icon: "price",
      title: "Price agreed first",
      text: "We diagnose the fault and agree the cost with you before any work starts.",
    },
    {
      icon: "gassafe",
      title: "Gas Safe registered",
      text: `Every engineer is Gas Safe registered (registration number ${business.gasSafeNumber}) and fully insured.`,
    },
    {
      icon: "check",
      title: "£50 call-out, refunded when fixed",
      text: "Not a hidden charge — it comes straight off your bill once we fix it.",
    },
    {
      icon: "shield",
      title: "30-day guarantee",
      text: "If the same fault comes back within 30 days, we'll return and put it right at no extra cost.",
    },
    {
      icon: "boiler",
      title: "All major brands",
      text: "Worcester Bosch, Vaillant, Baxi, Ideal, Glow-worm and more.",
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
  headline: "Annual service from £79 — keep it safe, keep the warranty valid",
  subline:
    "A full safety check and service from a Gas Safe engineer — most manufacturers require it to keep your boiler's warranty valid.",
  cta: "Book a service",
  ticks: ["From £79", "Gas Safe registered", "Takes around 45 minutes"],
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
      text: "Spotting a worn part now is cheaper than an emergency repair later.",
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
  headline: "A new boiler, fitted properly — fixed price, no surprises",
  subline:
    "Free, no-obligation quotes on new boiler installations from all major manufacturers, fitted by a Gas Safe engineer.",
  cta: "Get a quote",
  ticks: ["Free quotes", "Fixed price", "Gas Safe registered"],
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
  headline: "Commercial gas, heating and electrics — sorted without disrupting your business",
  subline:
    "Gas appliances, catering equipment, commercial boilers and EICR/gas safety certification, with priority call-outs so downtime doesn't cost you.",
  cta: "Enquire about commercial services",
  ticks: ["Priority call-outs", "Gas Safe registered", "Account invoicing available"],
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

export const finalCta = {
  headline: "Boiler playing up? Let's get it sorted.",
  cta: "Book a visit",
};

export const footerLinks: { label: string; href?: string }[] = [
  { label: "Commercial", href: "/commercial" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
