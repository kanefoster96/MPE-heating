// Terms & Conditions and Privacy Policy content. Written as a reasonable,
// genuine first draft covering the bases a UK home-services trade
// business needs (pricing/cancellation terms, Consumer Contracts
// Regulations, lawful liability wording, UK GDPR basics) — NOT a
// substitute for a solicitor's review. Both pages carry a visible
// callout saying so; don't remove it without actually getting that
// review done.
//
// Deliberately doesn't claim things we can't verify: no company
// registration number or ICO registration number (add these once
// confirmed), no specific accepted payment methods beyond what's already
// established elsewhere on the site, no premises address (MPE is a
// service-area business, consistent with the SEO work's decision not to
// publish one).

import type { ContentBlock } from "./richContent";
import { business } from "./content";

const TERMS_DISCLAIMER: ContentBlock = {
  type: "callout",
  text: "This is a general template, not a substitute for legal advice — have it reviewed by a solicitor before relying on it, particularly the cancellation and liability sections.",
};

const PRIVACY_DISCLAIMER: ContentBlock = {
  type: "callout",
  text: "This is a general template, not a substitute for legal advice — worth having it reviewed to confirm it fully reflects how your systems handle data, especially once payments and accounts are fully connected.",
};

export const lastUpdated = "28 August 2026";

export const termsContent: ContentBlock[] = [
  {
    type: "p",
    text: `These terms apply to any booking, quote, or work carried out by ${business.fullName} ("MPE", "we", "us"). We're a Gas Safe registered heating, plumbing and electrical business based in Whitley Bay (Gas Safe registration number ${business.gasSafeNumber}). By booking a visit or accepting a quote from us, you agree to these terms.`,
  },
  { type: "h2", text: "Quotes and pricing" },
  {
    type: "p",
    text: "For repairs, we charge a £50 call-out fee to attend and diagnose the fault. If you go ahead with the repair, that £50 is deducted from your final bill — you don't pay it twice. If you decide not to proceed after diagnosis, the £50 call-out is what you pay.",
  },
  {
    type: "p",
    text: "For servicing and new boiler installations, we agree a fixed price with you before any work starts. We'll always agree the price for any repair work beyond the initial diagnosis before carrying it out — you won't be charged for anything you haven't approved.",
  },
  { type: "h2", text: "Payment" },
  {
    type: "p",
    text: "Payment is due on completion of the work, unless we've agreed a different arrangement with you in advance (for example, an invoiced account for commercial or landlord clients). Accepted payment methods are confirmed when you book, or by your engineer on the day.",
  },
  { type: "h2", text: "Cancellations and rescheduling" },
  {
    type: "p",
    text: "You can cancel or reschedule a booking any time before the engineer arrives — just call or message us. If you cancel once an engineer is on their way or has arrived, the £50 call-out fee may still apply.",
  },
  {
    type: "p",
    text: "If you booked as a consumer (rather than a business) online or by phone, you have a legal right to cancel within 14 days under the Consumer Contracts Regulations 2013. If you ask us to start work within that 14-day period, you're agreeing to waive part or all of that cancellation right once the work is complete or under way, in line with those regulations.",
  },
  { type: "h2", text: "Our guarantee" },
  {
    type: "p",
    text: "Every repair we carry out is covered by a 30-day guarantee. If the same fault reoccurs within 30 days, we'll come back and put it right at no extra cost. This covers our workmanship — it doesn't cover unrelated faults, parts we didn't supply or fit, or damage caused after our visit.",
  },
  {
    type: "p",
    text: "New boilers and appliances we supply are also covered by the manufacturer's own warranty, which we register on your behalf.",
  },
  { type: "h2", text: "Gas Safe and compliance" },
  {
    type: "p",
    text: `All gas work is carried out by Gas Safe registered engineers, in line with the Gas Safety (Installation and Use) Regulations. You can check our registration (number ${business.gasSafeNumber}) at any time on the Gas Safe Register.`,
  },
  { type: "h2", text: "Liability" },
  {
    type: "p",
    text: "We carry out all work with reasonable care and skill, in line with the Consumer Rights Act 2015. Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud, or for anything else that can't be limited or excluded under English law.",
  },
  {
    type: "p",
    text: "Beyond that, our liability for any loss or damage arising from work we carry out is limited to the value of that work, except where a greater liability is required by law.",
  },
  { type: "h2", text: "Complaints" },
  {
    type: "p",
    text: `If something's not right, tell us — most issues are best sorted quickly and directly. Contact us on ${business.phoneDisplay} or ${business.email} and we'll do our best to put it right. If we can't resolve something between us, you're entitled to raise it with Trading Standards or, for gas safety concerns specifically, the Gas Safe Register.`,
  },
  { type: "h2", text: "Changes to these terms" },
  {
    type: "p",
    text: "We may update these terms from time to time — the version in force at the time you book is the one that applies.",
  },
  { type: "h2", text: "Governing law" },
  {
    type: "p",
    text: "These terms are governed by the law of England and Wales, and any disputes will be handled by the courts of England and Wales.",
  },
  TERMS_DISCLAIMER,
];

export const privacyContent: ContentBlock[] = [
  {
    type: "p",
    text: `${business.fullName} ("MPE", "we", "us") is the data controller for the personal information described in this policy. We're a Gas Safe registered heating, plumbing and electrical business covering ${business.region}. If you have any questions about how we handle your data, contact us at ${business.email} or ${business.phoneDisplay}.`,
  },
  { type: "h2", text: "What information we collect" },
  {
    type: "list",
    items: [
      "Contact details you give us — name, phone number, email address, and postal address — when you book a visit, request a quote, or get in touch through our contact form.",
      "Account information, if you create an account — the same contact details, plus details about your boiler and the work we've carried out, so you and our team have a record of it.",
      "Postcode and address lookups — when you search for your address on our site, your postcode is sent to our address-lookup provider to return matching addresses. We don't store the postcode you search unless you go on to submit it as part of a booking.",
      "Payment information — card payments, when available, are handled directly by our payment provider. We don't see or store your full card details.",
      "Basic technical information — standard web server logs (like browser type and IP address), used only to keep the site running securely.",
    ],
  },
  { type: "h2", text: "How we use your information" },
  {
    type: "p",
    text: "We use your information to respond to enquiries, arrange and carry out bookings, take payment, keep a record of work done on your property (so future visits go smoothly), and meet our legal and Gas Safe record-keeping obligations. We don't use your information for marketing you haven't agreed to, and we don't sell it.",
  },
  { type: "h2", text: "Who we share it with" },
  {
    type: "p",
    text: "We share information only where it's needed to provide our service — for example, with our address-lookup and payment providers. We don't share your information with third parties for their own marketing purposes.",
  },
  { type: "h2", text: "How long we keep it" },
  {
    type: "p",
    text: "We keep booking and job records for as long as needed for guarantee, warranty and legal/tax purposes — generally up to 6 years, in line with standard UK record-keeping requirements for trade businesses. You can ask us to delete your account and personal data at any time, subject to what we're legally required to keep.",
  },
  { type: "h2", text: "Your rights" },
  {
    type: "list",
    items: [
      "Access the personal information we hold about you",
      "Ask us to correct anything inaccurate",
      "Ask us to delete your information, where we're not required to keep it",
      "Object to or restrict certain uses of your information",
      "Ask for your information in a portable format",
      "Complain to the Information Commissioner's Office (ICO) at ico.org.uk if you think we've got something wrong",
    ],
  },
  { type: "p", text: `To exercise any of these rights, contact us at ${business.email}.` },
  { type: "h2", text: "Cookies" },
  {
    type: "p",
    text: "We don't currently use tracking or advertising cookies. If that changes — for example, if we add analytics in future — we'll update this policy and, where required, ask for your consent first.",
  },
  { type: "h2", text: "Children" },
  {
    type: "p",
    text: "Our services are aimed at adults booking work on their property or business — we don't knowingly collect information from children.",
  },
  { type: "h2", text: "Changes to this policy" },
  { type: "p", text: "We may update this policy from time to time. The version published here is always the current one." },
  PRIVACY_DISCLAIMER,
];
