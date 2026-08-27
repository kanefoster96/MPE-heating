// Central place for editable site copy & business details.
// Swap placeholder values (phone, Gas Safe number, reviews) for the real thing before launch.

export const business = {
  name: "MPE",
  fullName: "MPE Gas, Heating, Plumbing & Electrics",
  phoneDisplay: "07000 123 456",
  phoneHref: "tel:07000123456",
  whatsappHref: "https://wa.me/447000123456",
  email: "info@mpeheating.co.uk",
  gasSafeNumber: "123456",
  areas:
    "Covering Newcastle, North Tyneside, Gateshead, South Tyneside, Sunderland and Northumberland.",
};

export type PromoMessage = { text: string; tone?: "cold" };

// Rotates in the promo banner, one message every 5s. The first message stays
// fixed as the lead-in; the rest cycle after it. tone: "cold" swaps the
// banner to a blue "boiler's out" treatment instead of the default yellow.
export const promoMessages: PromoMessage[] = [
  { text: "£50 call-out, deducted from your final bill." },
  { text: "Boiler broken down? Same-day response.", tone: "cold" },
  { text: "No fix, no fee — you only pay if we solve it." },
  { text: "Free, no-obligation quotes on new boilers." },
  { text: "Gas Safe engineers, price agreed before we start." },
];

export const hero = {
  label: "Boiler Repairs",
  headline: "Boiler broken? Same-day repairs across the North East",
  subline: "Gas Safe registered engineers, price agreed before any work starts.",
  cta: "Book a visit",
  ticks: [
    "Same-day response",
    "£50 call-out deducted",
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

export const finalCta = {
  headline: "Boiler playing up? Let's get it sorted.",
  cta: "Book a visit",
};

export const footerLinks: { label: string; href?: string }[] = [
  { label: "Commercial" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
