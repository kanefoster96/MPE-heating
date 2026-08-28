"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { AccountTypeToggle, type AccountType } from "@/components/AccountTypeToggle";
import { FormField } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import {
  isValidEmail,
  isValidPhone,
  passwordMeetsMinimum,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation";

type Errors = Partial<{
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeTerms: string;
}>;

// TODO(supabase): swap this stub for the real call once the project is
// connected, e.g.:
//   const { data, error } = await supabase.auth.signUp({
//     email,
//     password,
//     options: {
//       data: {
//         full_name: fullName,
//         phone,
//         address, // optional, either type
//         account_type: accountType, // "personal" | "business"
//         business_name: accountType === "business" ? businessName : null,
//       },
//     },
//   });
// account_type/business_name are the "commercial" label the client asked
// for — lets future marketing/CRM segment business vs personal customers.
// Pull all of this into a `profiles` table via a Postgres trigger on
// auth.users if you want it queryable, rather than only living in JWT
// metadata.
async function signUpStub(_fields: {
  accountType: AccountType;
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export default function CreateAccountPage() {
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isBusiness = accountType === "business";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const nextErrors: Errors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "Enter your full name.";
    if (isBusiness && businessName.trim().length < 2) {
      nextErrors.businessName = "Enter your business name.";
    }
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (!isValidPhone(phone)) nextErrors.phone = "Enter a valid phone number.";
    if (!passwordMeetsMinimum(password)) {
      nextErrors.password = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`;
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords don't match.";
    if (!agreeTerms) nextErrors.agreeTerms = "You need to agree to continue.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error } = await signUpStub({
      accountType,
      fullName,
      businessName,
      email,
      phone,
      address,
      password,
    });
    setSubmitting(false);

    setNotice(
      error ?? "Account creation isn't connected yet — the form is ready, the backend is next."
    );
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Track bookings, invoices and messages in one place."
      topSlot={<AccountTypeToggle value={accountType} onChange={setAccountType} />}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-terracotta hover:text-terracotta-dark">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField
          id="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />

        {isBusiness && (
          <FormField
            id="businessName"
            label="Business name"
            type="text"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            error={errors.businessName}
          />
        )}

        <FormField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
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
          id="address"
          label={isBusiness ? "Business address (optional)" : "Home address (optional)"}
          type="text"
          autoComplete="street-address"
          placeholder="Street, town, postcode"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          showStrength
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <div>
          <label className="flex items-start gap-2.5 text-sm text-navy/70">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-terracotta focus:ring-terracotta"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-semibold text-navy hover:text-terracotta">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-navy hover:text-terracotta">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="mt-1.5 text-xs font-medium text-terracotta">{errors.agreeTerms}</p>
          )}
        </div>

        {notice && (
          <p className="rounded-2xl bg-grey px-4 py-3 text-sm text-navy/70">{notice}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-terracotta py-3.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
