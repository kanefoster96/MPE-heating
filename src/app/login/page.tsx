"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import { isValidEmail } from "@/lib/validation";

type Errors = Partial<{ email: string; password: string }>;

// TODO(supabase): swap this stub for the real call once the project is
// connected, e.g.:
//   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
// Supabase enforces its own rate limiting on auth endpoints server-side —
// don't try to replicate that client-side, it's not meaningful protection.
async function loginStub(_email: string, _password: string): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const nextErrors: Errors = {};
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error } = await loginStub(email, password);
    setSubmitting(false);

    setNotice(
      error ?? "Sign-in isn't connected yet — the form is ready, the backend is next."
    );
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in to your account"
      subtitle="Access your bookings, invoices and messages."
      footer={
        <>
          Don&rsquo;t have an account?{" "}
          <Link href="/create-account" className="font-semibold text-terracotta hover:text-terracotta-dark">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete="current-password"
          />
          <Link
            href="/reset-password"
            className="mt-2 inline-block text-xs font-semibold text-navy/60 hover:text-navy"
          >
            Forgot password?
          </Link>
        </div>

        {notice && (
          <p className="rounded-2xl bg-grey px-4 py-3 text-sm text-navy/70">{notice}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-terracotta py-3.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
