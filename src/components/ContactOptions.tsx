import { business } from "@/lib/content";
import { MailIcon, PhoneIcon, WhatsAppIcon } from "./icons";

// The live chat is Kanvas One's chat.js, loaded in the layout only when
// the site's One id is set. Any element with data-chat-open opens it.
export const LIVE_CHAT_ON = !!process.env.NEXT_PUBLIC_KANVAS_SITE_ID;

// Every way to reach MPE, as a row of small pills: call, WhatsApp, email
// and (once it's switched on) live chat. Sits under each booking form.
export function ContactOptions({ className = "" }: { className?: string }) {
  const pill =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy transition-colors hover:border-navy/40";
  return (
    <div className={`text-center ${className}`}>
      <p className="text-sm text-text-2">Rather talk to us?</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a href={business.phoneHref} className={pill}>
          <PhoneIcon className="h-4 w-4" aria-hidden="true" />
          {business.phoneDisplay}
        </a>
        <a href={business.whatsappHref} target="_blank" rel="noopener noreferrer" className={pill}>
          <WhatsAppIcon className="h-4 w-4 text-whatsapp-dark" aria-hidden="true" />
          WhatsApp
        </a>
        <a href={`mailto:${business.email}`} className={pill}>
          <MailIcon className="h-4 w-4" aria-hidden="true" />
          Email
        </a>
        {LIVE_CHAT_ON && (
          <button type="button" data-chat-open="" className={pill}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-whatsapp-dark" />
            Live chat
          </button>
        )}
      </div>
    </div>
  );
}
