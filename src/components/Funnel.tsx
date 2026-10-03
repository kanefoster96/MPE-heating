"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormLayout } from "./FormLayout";
import { FormField } from "./FormField";
import { FeeNote } from "./FeeNote";
import { ArrowRightIcon, ChevronLeftIcon, PhoneIcon, WhatsAppIcon, QuestionIcon } from "./icons";
import { business, type TwoTone } from "@/lib/content";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { funnel, resolvePath, type FunnelNode } from "@/lib/funnel";
import { funnelIconMap } from "@/lib/funnelIcons";

type Errors = Partial<{ name: string; phone: string; email: string; message: string }>;

type Props = {
  // Where the funnel starts. Deep links (?path=boilers.service) and the
  // emergency/contact pages pass a starting path; `locked` stops the
  // visitor backing out above it (the page is the choice).
  initialPath?: string[];
  locked?: boolean;
  eyebrow: string;
  // Title shown while choosing. Leaves show their own.
  title: TwoTone;
  subtitle?: string;
};

function titleFor(node: FunnelNode | undefined, fallback: TwoTone): TwoTone {
  if (!node) return fallback;
  if (node.leaf?.type === "repair") return { lead: "Same-day call-out.", em: "£50, refunded when fixed." };
  if (node.leaf?.type === "quote") return { lead: "A new boiler.", em: "Free fixed-price quote." };
  if (node.leaf?.type === "service") return { lead: "Annual service.", em: "From £79, warranty kept valid." };
  if (node.leaf?.type === "commercial") return { lead: "Commercial cover.", em: "Priority call-outs." };
  if (node.leaf) return { lead: `${node.label}.`, em: "Tell us what you need." };
  return { lead: `${node.label}.`, em: "What do you need?" };
}

export function Funnel({ initialPath = [], locked = false, eyebrow, title, subtitle }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Path from props, or from ?path=a.b.c; anything that doesn't resolve
  // falls back to the top of the tree.
  const [path, setPath] = useState<string[]>(() => {
    const fromQuery = searchParams.get("path")?.split(".").filter(Boolean) ?? [];
    const candidate = initialPath.length ? initialPath : fromQuery;
    return resolvePath(candidate) ? candidate : [];
  });
  const minDepth = locked ? initialPath.length : 0;

  const nodes = useMemo(() => resolvePath(path) ?? [], [path]);
  const current = nodes[nodes.length - 1];
  const choices = current ? current.children : funnel;
  const leaf = current?.leaf;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(() => (searchParams.get("phone") ?? "").slice(0, 40));
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sameDay, setSameDay] = useState(() => searchParams.get("sameDay") === "1");
  const [company, setCompany] = useState(""); // honeypot
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<"unavailable" | "failed" | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const choose = (node: FunnelNode) => {
    setPath((p) => [...p, node.id]);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    if (path.length <= minDepth) {
      router.push("/");
      return;
    }
    setPath((p) => p.slice(0, -1));
    setNotice(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!leaf) return;
    setNotice(null);
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter your name.";
    if (!isValidPhone(phone)) next.phone = "Enter a valid phone number.";
    if (email.trim() && !isValidEmail(email)) next.email = "Enter a valid email address.";
    if (message.trim().length < 10) next.message = "Say a little more so we send the right engineer.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          message,
          type: leaf.type,
          path: nodes.map((n) => n.label),
          sameDayRequested: leaf.sameDay ? sameDay : false,
          company,
        }),
      });
      if (res.ok) setSubmitted(true);
      else setNotice(res.status === 503 ? "unavailable" : "failed");
    } catch {
      setNotice("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = name.trim().split(" ")[0];
  const trail = nodes.map((n) => n.label).join(" › ");

  if (submitted) {
    return (
      <FormLayout
        eyebrow="Sent"
        title={{ lead: `Thanks${firstName ? `, ${firstName}` : ""}.`, em: "We've got it." }}
        subtitle={
          sameDay && leaf?.sameDay
            ? "You've asked for someone today, so you're at the front of the queue. We'll ring you back shortly to confirm."
            : "We'll ring you back to confirm a time and agree the price before any work starts."
        }
      >
        <p className="text-sm text-text-2">
          <span className="font-semibold text-navy">What you asked for:</span> {trail}
        </p>
        <FallbackLinks className="mt-5" />
      </FormLayout>
    );
  }

  // ----- Details step (a leaf) -----
  if (leaf && current) {
    return (
      <FormLayout eyebrow={eyebrow} title={titleFor(current, title)} subtitle={subtitle}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Crumb trail={trail} canBack={path.length > minDepth} onBack={back} />

          {leaf.fee && <FeeNote />}

          <FormField id="name" label="Name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <FormField id="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
          <FormField id="email" label="Email address (optional)" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />

          <div>
            <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-navy">
              Anything we should know
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              placeholder={leaf.prompt}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!errors.message}
              className={`w-full resize-none rounded-2xl border px-4 py-3 text-base text-navy outline-none transition-colors placeholder:text-text-3 focus:border-navy/40 ${
                errors.message ? "border-red" : "border-line"
              }`}
            />
            {errors.message && <p className="mt-1.5 text-xs font-medium text-red">{errors.message}</p>}
          </div>

          {leaf.sameDay && (
            <label
              className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-2xl border px-4 py-3.5 text-sm transition-colors ${
                sameDay ? "border-navy bg-cream" : "border-line"
              }`}
            >
              <input
                type="checkbox"
                checked={sameDay}
                onChange={(e) => setSameDay(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-navy"
              />
              <span>
                <span className="block font-semibold text-navy">I need someone today</span>
                <span className="block text-text-2">You go to the front of the queue and we ring you back first.</span>
              </span>
            </label>
          )}

          {/* Honeypot: hidden from people, filled by bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>

          {notice && (
            <div className="rounded-2xl bg-grey px-4 py-4 text-sm text-text-2" role="alert">
              <p className="font-semibold text-navy">
                {notice === "unavailable" ? "Online booking is taking a short break." : "That didn’t send."}
              </p>
              <p className="mt-1">Call or WhatsApp us and we&rsquo;ll get you booked in straight away.</p>
              <FallbackLinks className="mt-3" />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-btn-gradient mt-1 inline-flex min-h-12 items-center justify-center rounded-full py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Sending…" : leaf.cta}
          </button>

          <p className="text-center text-xs leading-relaxed text-text-3">
            Price agreed before any work starts. Every repair guaranteed for 3 months.
          </p>
        </form>
      </FormLayout>
    );
  }

  // ----- Choice step -----
  return (
    <FormLayout eyebrow={eyebrow} title={titleFor(current, title)} subtitle={current ? undefined : subtitle} wide>
      <Crumb trail={trail} canBack={path.length > minDepth} onBack={back} />
      <ul className="mt-2 grid grid-cols-2 gap-3 sm:gap-4">
        {(choices ?? []).map((node) => {
          const Icon = funnelIconMap[node.icon];
          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => choose(node)}
                data-choice={node.id}
                className={`${SQUARE} border-line bg-cream hover:border-navy/40 hover:bg-white`}
              >
                <CardTop icon={<Icon />} primary={node.leaf?.sameDay === true} />
                <CardText label={node.label} text={node.text} />
              </button>
            </li>
          );
        })}
        {/* Every list below the top level ends with a way out to the
            contact form, for jobs that don't fit a card. */}
        {current && (
          <li>
            <Link
              href="/contact"
              data-contact
              className={`${SQUARE} border-dashed border-navy/25 bg-white hover:border-navy/50`}
            >
              <CardTop icon={<QuestionIcon />} />
              <CardText label="Something else?" text="Contact us today and we'll sort it." />
            </Link>
          </li>
        )}
      </ul>
      <p className="mt-5 text-center text-xs text-text-3">Two minutes. Price agreed before any work starts.</p>
    </FormLayout>
  );
}

// Square choice cards, two to a row: icon and arrow at the top, label and
// one line at the bottom.
const SQUARE =
  "group flex aspect-square w-full flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-colors sm:p-6";

function CardTop({ icon, primary = false }: { icon: ReactNode; primary?: boolean }) {
  return (
    <span className="flex items-start justify-between">
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-7 sm:[&_svg]:w-7 ${
          primary ? "bg-navy text-white" : "bg-white text-navy"
        }`}
      >
        {icon}
      </span>
      <ArrowRightIcon className="h-4 w-4 text-navy/50 transition-transform group-hover:translate-x-0.5 group-hover:text-navy sm:h-5 sm:w-5" />
    </span>
  );
}

function CardText({ label, text }: { label: string; text: string }) {
  return (
    <span className="block">
      <span className="line-clamp-2 text-[15px] font-bold leading-tight text-navy sm:text-xl">{label}</span>
      <span className="mt-1 line-clamp-1 text-xs leading-snug text-text-2 sm:mt-1.5 sm:line-clamp-3 sm:text-sm">
        {text}
      </span>
    </span>
  );
}

function Crumb({ trail, canBack, onBack }: { trail: string; canBack: boolean; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-text-2 hover:text-navy"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {canBack ? "Back" : "Home"}
      </button>
      {trail && (
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-text-3" data-trail>
          {trail}
        </p>
      )}
    </div>
  );
}

function FallbackLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <a
        href={business.phoneHref}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-navy/20 px-5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
      >
        <PhoneIcon className="h-4 w-4" />
        {business.phoneDisplay}
      </a>
      <a
        href={business.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-grey px-5 text-sm font-semibold text-navy transition-colors hover:bg-navy/10"
      >
        <WhatsAppIcon className="h-5 w-5 text-whatsapp" />
        WhatsApp us
      </a>
    </div>
  );
}
