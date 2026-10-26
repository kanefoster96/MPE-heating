import Link from "next/link";
import { business } from "@/lib/content";
import { CHAT_ON } from "@/lib/chat-on";
import { FormIcon, MailIcon, PhoneIcon } from "./icons";

// The live chat (/messages) shows once Supabase is set (lib/chat-on.ts).
export const LIVE_CHAT_ON = CHAT_ON;

function AppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M12 7.5v7M9 12l3 3 3-3" />
    </svg>
  );
}

// Every way to reach MPE, under each booking form: live chat, a call, the
// contact form, or the app. Until the live chat's switched on, it's email
// instead, so it's never a dead end.
export function ContactOptions({ className = "", onAppPage = false }: { className?: string; onAppPage?: boolean }) {
  const pill =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy transition-colors hover:border-navy/40";
  return (
    <div className={`text-center ${className}`} data-contact-options>
      <p className="text-sm text-text-2">Rather talk to us?</p>
      <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-2 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
        {LIVE_CHAT_ON ? (
          <Link href="/messages" className={pill}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-whatsapp-dark" />
            Live chat
          </Link>
        ) : (
          <a href={business.emailHref} className={pill}>
            <MailIcon className="h-4 w-4" aria-hidden="true" />
            Email us
          </a>
        )}
        <a href={business.phoneHref} className={pill} aria-label={`Call us on ${business.phoneDisplay}`}>
          <PhoneIcon className="h-4 w-4" aria-hidden="true" />
          Call us
        </a>
        <Link href="/contact" className={pill}>
          <FormIcon className="h-4 w-4" aria-hidden="true" />
          Contact form
        </Link>
        {!onAppPage && (
          <Link href="/app" className={pill}>
            <AppIcon className="h-4 w-4" />
            Get the app
          </Link>
        )}
      </div>
    </div>
  );
}
