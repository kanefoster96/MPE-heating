"use client";

import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { isValidEmail, isValidPhone } from "@/lib/validation";

type Errors = Partial<{
  name: string;
  phone: string;
  email: string;
  message: string;
}>;

// TODO(backend): wire this up once ready — either insert into a Supabase
// `contact_messages` table, or send it straight to Fergal as a
// transactional email (Resend/Postmark etc). Email is optional here since
// this site is phone/WhatsApp-first, so don't assume it's always present —
// phone is the fallback contact method either way.
async function sendMessageStub(_fields: {
  name: string;
  phone: string;
  email: string;
  message: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export default function ContactPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const nextErrors: Errors = {};
    if (name.trim().length < 2) nextErrors.name = "Enter your name.";
    if (!isValidPhone(phone)) nextErrors.phone = "Enter a valid phone number.";
    if (email.trim() && !isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (message.trim().length < 10) nextErrors.message = "Say a little more about your question.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error } = await sendMessageStub({ name, phone, email, message });
    setSubmitting(false);

    setNotice(
      error ?? "This isn't connected yet — the form is ready, the backend is next."
    );
  };

  return (
    <AuthLayout
      eyebrow="Get in touch"
      title="Have a question?"
      subtitle="No need to create an account — just send us a message and we'll get back to you."
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
            Message
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
