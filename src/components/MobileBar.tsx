import Link from "next/link";
import { business } from "@/lib/content";
import { contactHref } from "@/lib/enquiry";
import { PhoneIcon, WhatsAppIcon } from "./icons";

// Phone-only bar fixed to the bottom of the screen: Call, Chat, and the
// booking button. The spacer after it matches its height so it never
// covers the end of the page.
export function MobileBar() {
  return (
    <>
      <nav
        aria-label="Quick contact"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1fr_1.5fr] gap-2 border-t border-edge bg-white px-3 pt-2.5 pb-[calc(14px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(31,42,58,0.35)] md:hidden"
      >
        <a
          href={business.phoneHref}
          className="flex h-[50px] items-center justify-center gap-1.5 rounded-[14px] bg-cream text-[15px] font-semibold"
        >
          <PhoneIcon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden="true" />
          Call
        </a>
        <a
          href={business.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[50px] items-center justify-center gap-1.5 rounded-[14px] bg-whatsapp-tint text-[15px] font-semibold text-whatsapp-ink"
        >
          <WhatsAppIcon className="h-[17px] w-[17px]" aria-hidden="true" />
          Chat
        </a>
        <Link
          href={contactHref("repair")}
          className="flex h-[50px] items-center justify-center rounded-[14px] bg-terracotta-deep text-base font-bold text-white"
        >
          Book · £50
        </Link>
      </nav>
      <div aria-hidden="true" className="h-[calc(74px+env(safe-area-inset-bottom))] bg-cream md:hidden" />
    </>
  );
}
