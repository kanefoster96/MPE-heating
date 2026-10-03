"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { contactHref, type EnquiryType } from "@/lib/enquiry";

// The main ask: a 60px pill-shaped field with the action button inside its
// right end. Takes a phone number and carries it to the booking form so
// the visitor only types it once. The button is the one orange thing.
export function RoundField({
  cta,
  shortCta = "Book now",
  type = "repair",
  placeholder = "Your phone number",
  className = "",
}: {
  cta: string;
  // Phones get a shorter label so the field keeps room to type in.
  shortCta?: string;
  type?: EnquiryType;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = contactHref(type);
    const trimmed = phone.trim();
    if (!trimmed) {
      router.push(base);
      return;
    }
    const joiner = base.includes("?") ? "&" : "?";
    router.push(`${base}${joiner}phone=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={submit}
      className={`flex h-[60px] w-full max-w-xl items-center rounded-full border border-line bg-white p-1.5 pl-5 shadow-[0_18px_40px_-24px_rgba(31,42,58,0.45)] ${className}`}
    >
      <label htmlFor={`round-phone-${type}`} className="sr-only">
        Phone number
      </label>
      <input
        id={`round-phone-${type}`}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base text-navy outline-none placeholder:text-text-3"
      />
      <button
        type="submit"
        className="bg-btn-gradient inline-flex h-12 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold text-white sm:px-6"
      >
        <span className="sm:hidden">{shortCta}</span>
        <span className="hidden sm:inline">{cta}</span>
      </button>
    </form>
  );
}
