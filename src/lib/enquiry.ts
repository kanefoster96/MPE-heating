// The kinds of enquiry the forms send. The key goes in the email subject;
// the funnel (src/lib/funnel.ts) maps every choice onto one of these.

export type EnquiryType = "repair" | "service" | "quote" | "plan" | "commercial" | "other";

export const ENQUIRY_TYPES: Record<EnquiryType, { label: string }> = {
  repair: { label: "Boiler repair" },
  service: { label: "Boiler service" },
  quote: { label: "New boiler quote" },
  plan: { label: "Maintenance plan" },
  commercial: { label: "Commercial enquiry" },
  other: { label: "Enquiry" },
};

export function isEnquiryType(value: string | null | undefined): value is EnquiryType {
  return !!value && value in ENQUIRY_TYPES;
}

// Where a CTA for a given enquiry type lands:
// - repairs go straight to the emergency call-out form
// - services, new boiler quotes and plans have their own step-by-step forms
// - general questions go to the contact form
// - commercial drops into the booking funnel at its branch
export function contactHref(type: EnquiryType, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
  const q = params.toString() ? `?${params.toString()}` : "";
  switch (type) {
    case "repair":
      return `/emergency${q}`;
    case "other":
      return `/contact${q}`;
    case "service":
      return `/book/service${q}`;
    case "quote":
      return `/book/new-boiler${q}`;
    case "plan":
      return `/book/plan${q}`;
    case "commercial":
      params.set("path", "commercial");
      return `/book?${params.toString()}`;
  }
}
