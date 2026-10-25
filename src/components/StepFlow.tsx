"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { business, sameDay as sameDayCopy } from "@/lib/content";
import { flows, type Flow, type FlowKey, type FlowStep } from "@/lib/flows";
import { funnelIconMap } from "@/lib/funnelIcons";
import { formatPostcode, isValidEmail, isValidPostcode } from "@/lib/validation";
import { formatPhone, normalizePhone, PHONE_ERROR, PHONE_EXAMPLE } from "@/lib/phone";
import { HoneypotField, fillMsSince } from "./BotCheck";
import { useEmailTypoCheck } from "./EmailTypoPrompt";
import { WizardStepIndicator } from "./WizardStepIndicator";
import { SuccessCheck } from "./SuccessCheck";
import { ContactOptions, LIVE_CHAT_ON } from "./ContactOptions";
import { ChatButton } from "./ChatButton";
import { FeeNote } from "./FeeNote";
import { PhoneIcon, WhatsAppIcon } from "./icons";

// The dedicated booking forms (call-out, new boiler, service, plan), built
// on Kanvas Academy's trial form: one step per panel under numbered
// circles, tap a card and the next step fades up, contact details last
// with a summary of the answers, then a success screen. Also from the
// Academy: a draft kept on the device for a day, the honeypot and fill
// time against bots, the "did you mean @gmail.com?" check and the UK
// phone rules. Light colours, with the orange as the accent.

// Academy class strings, mapped to this site's light tokens.
const PANEL = "mt-6 flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-line bg-white p-6 text-left sm:p-8 animate-fade-up";
const INPUT =
  "w-full rounded-lg border bg-white px-4 py-3 text-base text-navy outline-none transition-colors placeholder:text-text-3 focus:border-navy/40";
const LABEL = "text-sm text-text-2";
const PRIMARY =
  "inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-terracotta-deep px-8 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-40";
const SECONDARY =
  "inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-line px-6 py-2.5 text-sm font-medium text-navy transition-colors hover:border-navy/40 active:bg-navy/10";
const CARD = "flex min-h-16 w-full gap-3 rounded-xl border p-4 text-left transition-colors";
const CARD_ON = "border-terracotta-deep bg-terracotta-deep/10";
const CARD_OFF = "border-line bg-cream hover:border-navy/30 active:bg-navy/10";

// ----- Draft kept on the device (Academy friend-pass form) -----
type Saved = {
  index: number;
  choices: Record<string, string>;
  texts: Record<string, string>;
  postcode: string;
  name: string;
  email: string;
  phone: string;
  savedAt: number;
};
const SAVE_FOR_MS = 24 * 60 * 60 * 1000;
const saveKey = (key: FlowKey) => `mpe-booking:${key}`;

function readSaved(key: FlowKey): Saved | null {
  try {
    const raw = window.localStorage.getItem(saveKey(key));
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved && Date.now() - saved.savedAt < SAVE_FOR_MS ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(key: FlowKey, saved: Saved | null) {
  try {
    if (saved) window.localStorage.setItem(saveKey(key), JSON.stringify(saved));
    else window.localStorage.removeItem(saveKey(key));
  } catch {
    // Private browsing or storage turned off: the form still works, it just won't remember.
  }
}

type Notice = "unavailable" | "failed" | null;
type FieldErrors = Partial<Record<"name" | "email" | "phone", string>>;

export function StepFlow({ flowKey }: { flowKey: FlowKey }) {
  const flow: Flow = flows[flowKey];
  const steps = flow.steps;
  const total = steps.length;
  const searchParams = useSearchParams();

  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [postcode, setPostcode] = useState("");
  const [name, setName] = useState("");
  // Carried over from an email field elsewhere on the site, if any.
  const [email, setEmail] = useState(() => (searchParams.get("email") ?? "").slice(0, 200));
  const [phone, setPhone] = useState(() => (searchParams.get("phone") ?? "").slice(0, 40));
  const [sameDay, setSameDay] = useState(false);
  const [website, setWebsite] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [restored, setRestored] = useState(false);
  // Set once the visitor has moved a step, so focus only moves after that.
  const [moved, setMoved] = useState(false);

  const loaded = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Picked up once on the device, after the first render (the server has
  // no storage to read).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const saved = readSaved(flow.key);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device's storage, which only exists after mounting
    setIndex(Math.min(Math.max(saved.index, 0), total - 1));
    setChoices(saved.choices ?? {});
    setTexts(saved.texts ?? {});
    setPostcode(saved.postcode ?? "");
    setName(saved.name ?? "");
    setEmail((current) => current || saved.email || "");
    setPhone((current) => current || saved.phone || "");
    setRestored(true);
  }, [flow.key, total]);

  useEffect(() => {
    if (!loaded.current || sent) return;
    const any = Object.keys(choices).length || Object.keys(texts).length || postcode || name || email || phone;
    writeSaved(flow.key, any ? { index, choices, texts, postcode, name, email, phone, savedAt: Date.now() } : null);
  }, [flow.key, index, choices, texts, postcode, name, email, phone, sent]);

  // Every step change goes back to the top and puts focus on the question,
  // so the next step is never missed (Academy trial form).
  useEffect(() => {
    if (!moved) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [index, sent, moved]);

  const emailTypo = useEmailTypoCheck(email, setEmail);

  function go(to: number) {
    setMoved(true);
    setErrors({});
    setNotice(null);
    setIndex(Math.min(Math.max(to, 0), total - 1));
  }

  function startAgain() {
    writeSaved(flow.key, null);
    setChoices({});
    setTexts({});
    setPostcode("");
    setName("");
    setEmail("");
    setPhone("");
    setSameDay(false);
    setRestored(false);
    go(0);
  }

  // The answers so far, as "question: answer", for the summary and email.
  function recap(): { q: string; a: string }[] {
    return steps.flatMap((s) => {
      if (s.kind === "choice" && choices[s.id]) {
        const picked = s.choices.find((c) => c.id === choices[s.id]);
        return picked ? [{ q: s.recap, a: picked.label }] : [];
      }
      if (s.kind === "text" && texts[s.id]?.trim()) return [{ q: s.recap, a: texts[s.id].trim() }];
      if (s.kind === "postcode" && isValidPostcode(postcode)) return [{ q: "Postcode", a: formatPostcode(postcode) }];
      return [];
    });
  }

  async function submit(chosenEmail?: string) {
    const step = steps[index];
    if (step.kind !== "contact") return;
    const finalEmail = (chosenEmail ?? email).trim();
    const e164 = normalizePhone(phone);
    const next: FieldErrors = {};
    if (step.name && name.trim().length < 2) next.name = "Enter your name.";
    if (!isValidEmail(finalEmail)) next.email = "Enter a valid email address.";
    if (!e164) next.phone = PHONE_ERROR;
    setErrors(next);
    if (Object.keys(next).length) return;
    // A doubtful address asks first; the prompt calls back with the choice.
    if (chosenEmail === undefined && !emailTypo.check()) return;

    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: flow.type,
          name: name.trim(),
          email: finalEmail,
          phone: formatPhone(e164!),
          postcode: formatPostcode(postcode),
          message: (texts.description ?? "").trim(),
          answers: recap(),
          path: [flow.label],
          sameDayRequested: !!step.sameDay && sameDay,
          website,
          fillMs: fillMsSince(openedAt),
        }),
      });
      if (res.ok) {
        writeSaved(flow.key, null);
        setMoved(true);
        setSent(true);
      } else {
        setNotice(res.status === 503 ? "unavailable" : "failed");
      }
    } catch {
      setNotice("failed");
    } finally {
      setSending(false);
    }
  }

  const callButtons = (
    <div className="grid grid-cols-[1.35fr_1fr] gap-2.5">
      <a
        href={business.phoneHref}
        className="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-terracotta-deep px-3 text-sm font-semibold text-white"
      >
        <PhoneIcon className="h-4 w-4" aria-hidden="true" />
        {business.phoneDisplay}
      </a>
      <a
        href={business.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-whatsapp-dark px-3 text-sm font-semibold text-white"
      >
        <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col items-center bg-cream px-4 pt-8 pb-12 sm:pt-12">
      <div className={`mb-6 flex w-full max-w-xl items-center ${LIVE_CHAT_ON ? "justify-between" : "justify-center"}`}>
        <Link href="/" className="inline-flex min-h-11 items-center" aria-label={`${business.name} home`}>
          <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} priority className="h-10 w-auto" />
        </Link>
        <ChatButton />
      </div>
      {children}
    </div>
  );

  // ----- Success (Academy trial confirmation) -----
  if (sent) {
    const answers = recap();
    return shell(
      <div className="flex w-full max-w-md flex-col items-center text-center animate-fade-up">
        <SuccessCheck />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-text-2">{flow.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-bold tracking-[-0.03em] outline-none">
          {flow.thanks.title.lead} <span className="em block">{flow.thanks.title.em}</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-text-2">{flow.thanks.text}</p>

        <div className="mt-6 w-full rounded-2xl border border-line bg-white p-6 text-left text-sm">
          <p className="text-xs uppercase tracking-widest text-text-2">Your request</p>
          <ul className="mt-2 flex flex-col gap-1.5" data-recap>
            {answers.map((r) => (
              <li key={r.q}>
                <span className="text-text-2">{r.q}:</span> <span className="font-semibold text-navy">{r.a}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-4 text-text-2">
            We&rsquo;ll reply to <strong className="text-navy">{email.trim()}</strong>. Not there yet? Check your junk folder too.
          </p>
        </div>

        {sameDay && (
          <div className="mt-4 w-full rounded-2xl border border-line bg-white p-5 text-left">
            <p className="text-sm text-text-2">{sameDayCopy.callLine}</p>
            <div className="mt-3">{callButtons}</div>
          </div>
        )}

        <Link href="/" className={`${PRIMARY} mt-8`}>
          Back to home
        </Link>
        <ContactOptions className="mt-8" />
      </div>
    );
  }

  const step: FlowStep = steps[index];
  const twoUp = step.kind === "choice" && !step.choices.some((c) => c.text);
  const canNext =
    step.kind === "choice"
      ? !!choices[step.id]
      : step.kind === "text"
        ? (texts[step.id] ?? "").trim().length >= step.minLength
        : step.kind === "postcode"
          ? isValidPostcode(postcode)
          : true;

  const backRow = (next?: React.ReactNode) => (
    <div className="mt-2 flex justify-between gap-3">
      {index > 0 ? (
        <button type="button" onClick={() => go(index - 1)} className={SECONDARY}>
          Back
        </button>
      ) : (
        <Link href="/" className={SECONDARY}>
          Home
        </Link>
      )}
      {next}
    </div>
  );

  const nextButton = (
    <button type="button" disabled={!canNext} onClick={() => go(index + 1)} className={PRIMARY}>
      Next
    </button>
  );

  return shell(
    <>
      <div className="w-full max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">{flow.eyebrow}</p>
        <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          {flow.title.lead} <span className="em block">{flow.title.em}</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-text-2">{flow.subtitle}</p>
      </div>

      <WizardStepIndicator total={total} current={index + 1} />

      {restored && (
        <p className="mt-6 w-full max-w-xl rounded-lg border border-whatsapp-dark/30 bg-whatsapp-dark/10 px-4 py-3 text-sm text-whatsapp-ink">
          Welcome back! We kept what you&rsquo;d filled in.{" "}
          <button type="button" onClick={startAgain} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            Start again
          </button>
        </p>
      )}

      <div key={index} className={PANEL} data-step={step.id}>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-navy outline-none sm:text-xl">
            {step.question}
          </h2>
          {step.help && <p className="mt-1 text-sm text-text-2">{step.help}</p>}
        </div>

        {step.kind === "choice" && (
          <>
            <div className={`grid gap-3 ${twoUp ? "grid-cols-2" : "sm:grid-cols-2"}`}>
              {step.choices.map((c) => {
                const selected = choices[step.id] === c.id;
                const Icon = c.icon ? funnelIconMap[c.icon] : null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    data-choice={c.id}
                    onClick={() => {
                      setChoices((prev) => ({ ...prev, [step.id]: c.id }));
                      go(index + 1);
                    }}
                    className={`${CARD} ${twoUp && Icon ? "flex-col items-start sm:flex-row sm:items-center" : "items-center"} ${selected ? CARD_ON : CARD_OFF}`}
                  >
                    {Icon && (
                      <span
                        aria-hidden="true"
                        className={`grid h-10 w-10 flex-none place-items-center rounded-lg ${
                          selected ? "bg-terracotta-deep text-white" : "bg-white text-navy"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    )}
                    <span>
                      <span className="block text-[15px] font-semibold leading-snug text-navy">{c.label}</span>
                      {c.text && <span className="mt-0.5 block text-sm leading-snug text-text-2">{c.text}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {backRow(choices[step.id] ? nextButton : undefined)}
          </>
        )}

        {step.kind === "text" && (
          <>
            <label htmlFor={`flow-${step.id}`} className="sr-only">
              {step.question}
            </label>
            <textarea
              id={`flow-${step.id}`}
              rows={3}
              value={texts[step.id] ?? ""}
              onChange={(e) => setTexts((prev) => ({ ...prev, [step.id]: e.target.value.slice(0, 1000) }))}
              placeholder={step.placeholder}
              className={`${INPUT} resize-none border-line`}
            />
            {backRow(nextButton)}
          </>
        )}

        {step.kind === "postcode" && (
          <>
            <label htmlFor="flow-postcode" className="sr-only">
              Postcode
            </label>
            <input
              id="flow-postcode"
              autoComplete="postal-code"
              autoCapitalize="characters"
              maxLength={9}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canNext) go(index + 1);
              }}
              placeholder="NE26 1AB"
              className={`${INPUT} border-line uppercase tracking-wide`}
            />
            {backRow(nextButton)}
          </>
        )}

        {step.kind === "contact" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-4"
          >
            {/* The answers so far, said once more before the button. */}
            <div className="rounded-xl border border-line bg-cream p-4 text-sm" data-recap>
              <p className="text-xs uppercase tracking-widest text-text-2">Your request</p>
              <ul className="mt-2 flex flex-col gap-1">
                {recap().map((r) => (
                  <li key={r.q}>
                    <span className="text-text-2">{r.q}:</span> <span className="font-semibold text-navy">{r.a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {step.name && (
              <div className="flex flex-col gap-2">
                <label htmlFor="flow-name" className={LABEL}>
                  Your name
                </label>
                <input
                  id="flow-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "flow-name-error" : undefined}
                  className={`${INPUT} ${errors.name ? "border-red/60" : "border-line"}`}
                />
                {errors.name && (
                  <p id="flow-name-error" className="text-xs text-red">
                    {errors.name}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="flow-email" className={LABEL}>
                Your email
              </label>
              <input
                id="flow-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "flow-email-error" : undefined}
                className={`${INPUT} ${errors.email ? "border-red/60" : "border-line"}`}
              />
              {errors.email && (
                <p id="flow-email-error" className="text-xs text-red">
                  {errors.email}
                </p>
              )}
              {emailTypo.renderPrompt((chosen) => void submit(chosen))}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="flow-phone" className={LABEL}>
                Your mobile
              </label>
              <input
                id="flow-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={PHONE_EXAMPLE}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "flow-phone-error" : "flow-phone-help"}
                className={`${INPUT} ${errors.phone ? "border-red/60" : "border-line"}`}
              />
              {errors.phone ? (
                <p id="flow-phone-error" className="text-xs text-red">
                  {errors.phone}
                </p>
              ) : (
                <p id="flow-phone-help" className="text-xs text-text-2">
                  So we can text or ring to confirm.
                </p>
              )}
            </div>

            {step.sameDay && (
              <div className={`rounded-xl border transition-colors ${sameDay ? "border-terracotta-deep bg-terracotta-deep/5" : "border-line bg-white"}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={sameDay}
                    onChange={(e) => setSameDay(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-terracotta-deep)]"
                  />
                  <span className="text-sm font-semibold text-navy">{sameDayCopy.tick}</span>
                </label>
                {/* Ticking shows the number: calling is the best route to today. */}
                {sameDay && (
                  <div className="fold-in px-4 pb-4" data-sameday-call>
                    <p className="mb-3 text-sm text-text-2">{sameDayCopy.callLine}</p>
                    {callButtons}
                  </div>
                )}
              </div>
            )}

            <HoneypotField value={website} onChange={setWebsite} />

            {notice && (
              <div role="alert" className="rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-navy">
                <p className="font-semibold">
                  {notice === "unavailable" ? "Online booking is taking a short break." : "That didn’t send."}
                </p>
                <p className="mt-1 text-text-2">Call or WhatsApp us and we&rsquo;ll sort it straight away.</p>
                <div className="mt-3">{callButtons}</div>
              </div>
            )}

            {backRow(
              <button type="submit" disabled={sending} className={PRIMARY}>
                {sending ? "Sending…" : step.submit}
              </button>
            )}
          </form>
        )}
      </div>

      {flow.fee && index === 0 && <FeeNote className="mt-4 w-full max-w-xl" />}

      <ContactOptions className="mt-8" />
    </>
  );
}
