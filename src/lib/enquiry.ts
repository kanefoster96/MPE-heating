// The kinds of enquiry the contact form takes. Site CTAs link to
// /contact?type=<key> so the right one is preselected; the key is also
// what the API route puts in the email subject.

export type EnquiryType = "repair" | "service" | "quote" | "commercial" | "other";

export const ENQUIRY_TYPES: Record<
  EnquiryType,
  { label: string; pill: string; prompt: string; cta: string }
> = {
  repair: {
    label: "Boiler repair",
    pill: "Boiler repair",
    prompt: "What's the boiler doing? Fault codes, noises, no heat or hot water…",
    cta: "Book a same-day repair",
  },
  service: {
    label: "Boiler service",
    pill: "Annual service",
    prompt: "Boiler make and model if you know it, and when it was last serviced.",
    cta: "Book a service",
  },
  quote: {
    label: "New boiler quote",
    pill: "New boiler quote",
    prompt: "Current boiler, roughly how many bedrooms and bathrooms, and anything you'd like changed.",
    cta: "Get a free quote",
  },
  commercial: {
    label: "Commercial enquiry",
    pill: "Commercial",
    prompt: "Type of premises, the equipment involved, and whether it's affecting trading.",
    cta: "Get a commercial quote",
  },
  other: {
    label: "General enquiry",
    pill: "Something else",
    prompt: "Tell us what you need and we'll point you to the right engineer.",
    cta: "Send message",
  },
};

export function isEnquiryType(value: string | null | undefined): value is EnquiryType {
  return !!value && value in ENQUIRY_TYPES;
}

export function contactHref(type: EnquiryType): string {
  return type === "other" ? "/contact" : `/contact?type=${type}`;
}
