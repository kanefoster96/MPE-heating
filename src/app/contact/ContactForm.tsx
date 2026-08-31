"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { CONTACT_HANDOFF_KEY, type ContactHandoff } from "@/lib/contactHandoff";

type Errors = Partial<{
  name: string;
  phone: string;
  email: string;
  message: string;
}>;

// TODO(supabase): insert into the `bookings` table (see
// supabase/migrations/20260828000000_init.sql) once a project is
// connected — profile_id stays null for a guest submission like this one,
// same_day_requested maps straight onto the new column there. Also worth
// sending Fergal a transactional email (Resend/Postmark etc) so he
// doesn't have to check the dashboard for every new booking. Email is
// optional here since this site is phone/WhatsApp-first, so don't assume
// it's always present — phone is the fallback contact method either way.
async function sendMessageStub(_fields: {
  name: string;
  phone: string;
  email: string;
  message: string;
  sameDayRequested: boolean;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export function ContactForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    const { error } = await sendMessageStub({ name, phone, email, message, sameDayRequested });
    setSubmitting(false);

    if (error) {
      setNotice(error);
      return;
    }

    // Hand the details across to /create-account so the customer doesn't
    // have to repeat themselves — read back there via useContactHandoff().
    const handoff: ContactHandoff = { name, phone, email, message, sameDayRequested };
    try {
      sessionStorage.setItem(CONTACT_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      // Private browsing / storage disabled — not fatal, they'll just
      // retype their details on the next page.
    }

    setSubmitted(true);
    setTimeout(() => router.push("/create-account"), 1400);
  };

  if (submitted) {
    return (
      <AuthLayout
        eyebrow="Message sent"
        title={`Thanks${name.trim() ? `, ${name.trim().split(" ")[0]}` : ""} — we've got it`}
        subtitle="An engineer will be in touch soon to get your problem fixed. Taking you to set up your account next…"
        hideContactLink
      >
        <div className="flex flex-col gap-5">
          <p className="rounded-2xl bg-grey px-4 py-3 text-sm text-navy/70">
            This isn&apos;t connected yet — the form is ready, the backend is next.
          </p>

          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm font-bold text-navy">Next: add your address and boiler details</p>
            <p className="mt-1.5 text-sm text-navy/70">
              So the team has everything ready before they call — no need to repeat yourself.
            </p>
            <button
              type="button"
              onClick={() => router.push("/create-account")}
              className="bg-btn-gradient mt-4 inline-flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold text-white sm:w-auto sm:px-6"
            >
              Continue
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Book a visit"
      title="Book a visit"
      subtitle="Let us know how we can help and an engineer will be in touch soon to get your problem fixed."
      hideContactLink
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />

        <FormField
          id="email"
          label="Email address (optional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-navy">
            What&apos;s the problem?
          </label>
          <textarea
            id="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={!!errors.message}
            className={`w-full resize-none rounded-2xl border px-4 py-3 text-base text-navy outline-none transition-colors focus:border-terracotta ${
              errors.message ? "border-terracotta" : "border-line"
            }`}
          />
          {errors.message && (
            <p className="mt-1.5 text-xs font-medium text-terracotta">{errors.message}</p>
          )}
        </div>

        <label className="flex items-start gap-2.5 rounded-2xl border border-line px-4 py-3.5 text-sm text-navy/80">
          <input
            type="checkbox"
            checked={sameDayRequested}
            onChange={(e) => setSameDayRequested(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-terracotta focus:ring-terracotta"
          />
          <span>
            <span className="font-semibold text-navy">Boiler broke down, same-day callout request</span>
          </span>
        </label>

        {notice && (
          <p className="rounded-2xl bg-grey px-4 py-3 text-sm text-navy/70">{notice}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-btn-gradient mt-1 inline-flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
      </form>
    </AuthLayout>
  );
}
