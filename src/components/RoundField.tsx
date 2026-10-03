"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { business, sameDay as sameDayCopy } from "@/lib/content";
import { ENQUIRY_TYPES, type EnquiryType } from "@/lib/enquiry";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { PhoneIcon, WhatsAppIcon } from "./icons";

type Status = "idle" | "sending" | "sent" | "unavailable" | "failed";

// What to prompt for in the request box, by enquiry type.
const prompts: Record<EnquiryType, string> = {
  repair: "What's wrong? E.g. no heating, or the boiler's showing an error code.",
  service: "Your boiler make, and when suits you.",
  quote: "What you have now, and what you'd like.",
  commercial: "Your business, and what you need.",
  other: "How can we help?",
};

// The main ask, in two steps on the spot. A 60px pill takes an email
// address; its button opens a box underneath for the request, with an
// "I need a same-day call-out" tick. Ticking it pops up our number with
// "call our engineers directly" (it's a nudge, not a priority promise)
// and an optional field to leave theirs. Then it sends from here, no new page.
export function RoundField({
  cta,
  shortCta = "Book now",
  type = "repair",
  placeholder = "Your email address",
  className = "",
}: {
  cta: string;
  // Phones get a shorter label so the field keeps room to type in.
  shortCta?: string;
  type?: EnquiryType;
  placeholder?: string;
  className?: string;
}) {
  const uid = useId();
  const ids = {
    email: `round-email-${type}-${uid}`,
    message: `round-message-${type}-${uid}`,
    sameDay: `round-sameday-${type}-${uid}`,
    phone: `round-phone-${type}-${uid}`,
    error: `round-error-${type}-${uid}`,
  };
  const offersSameDay = type === "repair" || type === "commercial" || type === "other";

  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sameDay, setSameDay] = useState(false);
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Put the cursor in the request box as soon as it opens.
  useEffect(() => {
    if (open) messageRef.current?.focus();
  }, [open]);

  const showNumbers = () => dialogRef.current?.showModal();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!open) {
      setError(null);
      setOpen(true);
      return;
    }
    if (message.trim().length < 10) {
      setError("Say a little more so we can help.");
      messageRef.current?.focus();
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      setError("Check the phone number, or leave it blank.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          email: email.trim(),
          message: message.trim(),
          phone: phone.trim() || undefined,
          sameDayRequested: offersSameDay && sameDay,
          path: [ENQUIRY_TYPES[type].label],
          company,
        }),
      });
      setStatus(res.ok ? "sent" : res.status === 503 ? "unavailable" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  const contactButtons = (
    <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-2.5">
      <a
        href={business.phoneHref}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-terracotta-deep px-3 text-base font-semibold whitespace-nowrap text-white"
      >
        <PhoneIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        {business.phoneDisplay}
      </a>
      <a
        href={business.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-whatsapp-dark text-base font-semibold text-white"
      >
        <WhatsAppIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );

  if (status === "sent") {
    return (
      <div role="status" className={`w-full max-w-xl rounded-3xl border border-line bg-white p-6 text-left ${className}`}>
        <p className="text-xl font-extrabold">We&rsquo;ve got it.</p>
        <p className="mt-2 text-base leading-relaxed text-text-2">
          We&rsquo;ll reply to <span className="font-semibold text-navy">{email.trim()}</span> as soon as we can
          {sameDay && phone.trim() ? (
            <>
              , and ring you on <span className="font-semibold text-navy">{phone.trim()}</span> about today
            </>
          ) : null}
          .
        </p>
        {sameDay && !phone.trim() && (
          <>
            <p className="mt-3 text-base text-text-2">{sameDayCopy.callLine}</p>
            {contactButtons}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-xl ${className}`}>
      <form onSubmit={submit} noValidate>
        <div className="flex h-[60px] w-full items-center rounded-full border border-line bg-white p-1.5 pl-5 shadow-[0_18px_40px_-24px_rgba(31,42,58,0.45)]">
          <label htmlFor={ids.email} className="sr-only">
            Email address
          </label>
          <input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-invalid={!!error && !isValidEmail(email)}
            aria-describedby={error ? ids.error : undefined}
            className="min-w-0 flex-1 bg-transparent text-base text-navy outline-none placeholder:text-text-3"
          />
          {!open && (
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-terracotta-deep px-5 text-sm font-semibold text-white transition-colors hover:bg-ticket-stub sm:px-6"
            >
              <span className="sm:hidden">{shortCta}</span>
              <span className="hidden sm:inline">{cta}</span>
            </button>
          )}
        </div>

        {/* Honeypot: hidden from people, bots fill it in. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Company
            <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
        </div>

        {open && (
          <div className="fold-in mt-3 rounded-3xl border border-line bg-white p-4 text-left shadow-[0_18px_40px_-28px_rgba(31,42,58,0.45)] sm:p-5">
            <label htmlFor={ids.message} className="text-sm font-semibold">
              Your request
            </label>
            <textarea
              id={ids.message}
              ref={messageRef}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={prompts[type]}
              className="mt-2 block w-full resize-y rounded-2xl border border-line bg-cream px-4 py-3 text-base leading-relaxed text-navy outline-none placeholder:text-text-3 focus:border-navy/40"
            />

            {offersSameDay && (
              <div className="mt-3">
                <label htmlFor={ids.sameDay} className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold">
                  <input
                    id={ids.sameDay}
                    type="checkbox"
                    checked={sameDay}
                    onChange={(e) => {
                      setSameDay(e.target.checked);
                      if (e.target.checked) showNumbers();
                    }}
                    className="h-5 w-5 flex-none accent-terracotta-deep"
                  />
                  {sameDayCopy.tick}
                </label>
                {sameDay && (
                  <button
                    type="button"
                    onClick={showNumbers}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-text-2 underline underline-offset-4"
                  >
                    {phone.trim() ? `We'll ring you on ${phone.trim()}. Change` : "Show our number"}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-terracotta-deep text-base font-bold text-white transition-colors hover:bg-ticket-stub disabled:opacity-70"
            >
              {status === "sending" ? "Sending…" : "Send request"}
            </button>
            <p className="mt-2 text-center text-xs text-text-3">We reply by email. No spam, ever.</p>
          </div>
        )}

        {error && (
          <p id={ids.error} role="alert" className="mt-2 text-sm font-semibold text-red">
            {error}
          </p>
        )}

        {(status === "unavailable" || status === "failed") && (
          <div role="alert" className="mt-3 rounded-3xl border border-line bg-white p-5 text-left">
            <p className="font-bold">
              {status === "unavailable" ? "Online booking is taking a short break." : "That didn’t send."}
            </p>
            <p className="mt-1 text-sm text-text-2">Call or WhatsApp us and we&rsquo;ll sort it straight away.</p>
            {contactButtons}
          </div>
        )}
      </form>

      {offersSameDay && (
        <dialog
          ref={dialogRef}
          aria-labelledby={`${ids.sameDay}-title`}
          className="m-auto w-[min(92vw,26rem)] rounded-3xl p-0 text-left text-navy backdrop:bg-navy/60"
        >
          <div className="p-6">
            <p id={`${ids.sameDay}-title`} className="text-2xl font-extrabold tracking-[-0.02em]">
              Need someone today?
            </p>
            <p className="mt-2 text-base leading-relaxed text-text-2">
              {sameDayCopy.callLine}
            </p>
            {contactButtons}
            <label htmlFor={ids.phone} className="mt-5 block text-sm font-semibold">
              Or leave your number and we&rsquo;ll ring you
            </label>
            <input
              id={ids.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone number"
              className="mt-2 h-12 w-full rounded-full border border-line bg-cream px-5 text-base text-navy outline-none placeholder:text-text-3 focus:border-navy/40"
            />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-full border-[1.5px] border-navy text-base font-semibold transition-colors hover:bg-navy hover:text-white"
            >
              Done
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
