"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { FormLayout } from "@/components/FormLayout";
import { FormField } from "@/components/FormField";
import { WhatsAppIcon, PhoneIcon } from "@/components/icons";
import { business } from "@/lib/content";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { ENQUIRY_TYPES, isEnquiryType, type EnquiryType } from "@/lib/enquiry";

type Errors = Partial<{
  name: string;
  phone: string;
  email: string;
  message: string;
}>;

const TYPE_ORDER: EnquiryType[] = ["repair", "service", "quote", "commercial", "other"];

export function ContactForm() {
  // Preselected from /contact?type=… — the page wraps this component in
  // Suspense, which useSearchParams needs for static rendering.
  const searchParams = useSearchParams();
  const [type, setType] = useState<EnquiryType>(() => {
    const param = searchParams.get("type");
    return isEnquiryType(param) ? param : "repair";
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [company, setCompany] = useState(""); // honeypot, hidden from people
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<"unavailable" | "failed" | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const nextErrors: Errors = {};
    if (name.trim().length < 2) nextErrors.name = "Enter your name.";
    if (!isValidPhone(phone)) nextErrors.phone = "Enter a valid phone number.";
    if (email.trim() && !isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (message.trim().length < 10) nextErrors.message = "Say a little more about the problem.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, message, type, sameDayRequested, company }),
      });
      if (response.ok) {
        setSubmitted(true);
      } else {
        setNotice(response.status === 503 ? "unavailable" : "failed");
      }
    } catch {
      setNotice("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const current = ENQUIRY_TYPES[type];
  const firstName = name.trim().split(" ")[0];

  if (submitted) {
    return (
      <FormLayout
        eyebrow="Sent"
        title={`Thanks${firstName ? `, ${firstName}` : ""}. We've got it.`}
        subtitle={
          sameDayRequested
            ? "You've asked for a same-day callout, so we'll ring you back as soon as an engineer is free to confirm a time."
            : "We'll ring you back to confirm a time. If it's urgent, call or WhatsApp us now and we'll move faster."
        }
        hideContactLink
      >
        <ContactFallbackLinks />
      </FormLayout>
    );
  }

  return (
    <FormLayout
      eyebrow="Book a visit"
      title={type === "quote" ? "Get a free fixed-price quote" : "Book a visit"}
      subtitle="Two minutes. Tell us what you need and we'll ring you back to agree a time, and the price, before anyone starts work."
      hideContactLink
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 block text-sm font-semibold text-navy">What do you need?</legend>
          <div className="flex flex-wrap gap-2">
            {TYPE_ORDER.map((key) => {
              const selected = key === type;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  aria-pressed={selected}
                  className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected ? "bg-navy text-white" : "bg-grey text-navy/70 hover:bg-line"
                  }`}
                >
                  {ENQUIRY_TYPES[key].pill}
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormField
          id="name"
          label="Name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <FormField
          id="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />

        <FormField
          id="email"
          label="Email address (optional)"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-navy">
            Tell us a bit more
          </label>
          <textarea
            id="message"
            rows={4}
            value={message}
            placeholder={current.prompt}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={!!errors.message}
            className={`w-full resize-none rounded-2xl border px-4 py-3 text-base text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-terracotta ${
              errors.message ? "border-terracotta" : "border-line"
            }`}
          />
          {errors.message && (
            <p className="mt-1.5 text-xs font-medium text-terracotta">{errors.message}</p>
          )}
        </div>

        {type === "repair" && (
          <label className="flex min-h-11 items-start gap-2.5 rounded-2xl border border-line px-4 py-3.5 text-sm text-navy/80">
            <input
              type="checkbox"
              checked={sameDayRequested}
              onChange={(e) => setSameDayRequested(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-terracotta"
            />
            <span className="font-semibold text-navy">No heating or hot water. I need someone today.</span>
          </label>
        )}

        {/* Honeypot: hidden from people, filled by bots. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input
            id="company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        {notice && (
          <div className="rounded-2xl bg-grey px-4 py-4 text-sm text-navy/80">
            <p className="font-semibold text-navy">
              {notice === "unavailable"
                ? "Online booking is taking a short break."
                : "That didn’t send."}
            </p>
            <p className="mt-1">Call or WhatsApp us and we&rsquo;ll get you booked in straight away.</p>
            <ContactFallbackLinks compact />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-btn-gradient mt-1 inline-flex min-h-12 items-center justify-center rounded-full py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Sending…" : current.cta}
        </button>

        <p className="text-center text-xs text-navy/50">
          Price agreed before any work starts. Every repair guaranteed for 3 months.
        </p>
      </form>
    </FormLayout>
  );
}

function ContactFallbackLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${compact ? "mt-3" : ""}`}>
      <a
        href={business.phoneHref}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-terracotta px-5 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta hover:text-white"
      >
        <PhoneIcon className="h-4 w-4" />
        {business.phoneDisplay}
      </a>
      <a
        href={business.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-grey px-5 text-sm font-semibold text-navy transition-colors hover:bg-line"
      >
        <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
        WhatsApp us
      </a>
    </div>
  );
}
