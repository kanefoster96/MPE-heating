"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { AccountTypeToggle, type AccountType } from "@/components/AccountTypeToggle";
import { AddressFinder } from "@/components/AddressFinder";
import { FormField } from "@/components/FormField";
import { SelectField } from "@/components/SelectField";
import { PasswordField } from "@/components/PasswordField";
import { CheckIcon } from "@/components/icons";
import { boilerBrands } from "@/lib/content";
import { readContactHandoff, clearContactHandoff } from "@/lib/contactHandoff";
import {
  isValidEmail,
  isValidPhone,
  passwordMeetsMinimum,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation";

const BOILER_BRAND_OPTIONS = ["Not sure", ...boilerBrands, "Other"];
const BOILER_AGE_OPTIONS = ["Not sure", "0–2 years", "3–5 years", "6–10 years", "10+ years"];

type Errors = Partial<{
  fullName: string;
  companyName: string;
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
//         account_type: accountType, // "home" | "commercial"
//         company_name: accountType === "commercial" ? companyName : null,
//         vat_number: accountType === "commercial" ? vatNumber : null,
//         company_reg_number: accountType === "commercial" ? companyRegNumber : null,
//       },
//     },
//   });
// account_type/company_name are the "commercial" label the client asked
// for — lets future marketing/CRM segment home vs commercial customers.
// This metadata shape is already picked up by the handle_new_user trigger
// in supabase/migrations/20260828000000_init.sql, which copies it into a
// queryable `profiles` row on signup — no extra wiring needed once
// Supabase is connected. address isn't in that metadata shape today
// though; it'll need adding to both this call and the trigger together.
//
// boilerMake/boilerAge/problemDescription aren't part of the signup call
// itself — once there's a real profile id, insert a row into `boilers`
// (make, notes) and update the matching `bookings` row (same_day_requested
// already carries across from the contact form) rather than stuffing them
// into auth metadata.
async function signUpStub(_fields: {
  accountType: AccountType;
  fullName: string;
  companyName: string;
  vatNumber: string;
  companyRegNumber: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  boilerMake: string;
  boilerAge: string;
  problemDescription: string;
  sameDayRequested: boolean;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export function CreateAccountForm() {
  const [accountType, setAccountType] = useState<AccountType>("home");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [companyRegNumber, setCompanyRegNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [boilerMake, setBoilerMake] = useState("Not sure");
  const [boilerAge, setBoilerAge] = useState("Not sure");
  const [problemDescription, setProblemDescription] = useState("");
  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Prefill from the contact form if they've just come from there — see
  // src/lib/contactHandoff.ts. sessionStorage doesn't exist during SSR, so
  // this has to run in an effect rather than a useState lazy initializer
  // (which would read it during the client's first render and mismatch
  // against the empty-fields server render). Read once on mount; the form
  // fields become the source of truth from here, so clear the handoff
  // straight away.
  useEffect(() => {
    const handoff = readContactHandoff();
    if (!handoff) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe prefill from sessionStorage, not derivable from props/render
    setFullName(handoff.name);
    setPhone(handoff.phone);
    setEmail(handoff.email);
    setProblemDescription(handoff.message);
    setSameDayRequested(handoff.sameDayRequested);
    clearContactHandoff();
  }, []);

  const isCommercial = accountType === "commercial";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const nextErrors: Errors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "Enter your full name.";
    if (isCommercial && companyName.trim().length < 2) {
      nextErrors.companyName = "Enter your company name.";
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
      companyName,
      vatNumber,
      companyRegNumber,
      email,
      phone,
      address,
      password,
      boilerMake,
      boilerAge,
      problemDescription,
      sameDayRequested,
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
        {sameDayRequested && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-terracotta-light px-4 py-3 text-sm font-semibold text-terracotta-dark">
            <CheckIcon className="h-4 w-4 shrink-0" />
            Same-day callout requested — noted
          </div>
        )}

        <FormField
          id="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />

        {isCommercial && (
          <>
            <FormField
              id="companyName"
              label="Company name"
              type="text"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              error={errors.companyName}
            />

            <FormField
              id="vatNumber"
              label="VAT number (optional)"
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
            />

            <FormField
              id="companyRegNumber"
              label="Company registration number (optional)"
              type="text"
              value={companyRegNumber}
              onChange={(e) => setCompanyRegNumber(e.target.value)}
            />
          </>
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

        <AddressFinder
          label={isCommercial ? "Business address (optional)" : "Home address (optional)"}
          address={address}
          onAddressChange={setAddress}
        />

        <div className="border-t border-line pt-5">
          <p className="text-sm font-bold text-navy">Boiler details</p>
          <p className="mt-1 text-sm text-navy/70">
            So your engineer knows what to expect before they arrive — all optional.
          </p>

          <div className="mt-4 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="boilerMake"
                label="Boiler brand"
                options={BOILER_BRAND_OPTIONS}
                value={boilerMake}
                onChange={(e) => setBoilerMake(e.target.value)}
              />

              <SelectField
                id="boilerAge"
                label="Boiler age"
                options={BOILER_AGE_OPTIONS}
                value={boilerAge}
                onChange={(e) => setBoilerAge(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="problemDescription" className="mb-1.5 block text-sm font-semibold text-navy">
                What&apos;s the problem?
              </label>
              <textarea
                id="problemDescription"
                rows={3}
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                className="w-full resize-none rounded-2xl border border-line px-4 py-3 text-base text-navy outline-none transition-colors focus:border-terracotta"
              />
            </div>
          </div>
        </div>

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
          className="bg-btn-gradient mt-1 inline-flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
