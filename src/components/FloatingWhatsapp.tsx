import { business } from "@/lib/content";
import { WhatsAppIcon } from "./icons";

export function FloatingWhatsapp() {
  return (
    <a
      href={business.whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_-8px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <WhatsAppIcon />
    </a>
  );
}
