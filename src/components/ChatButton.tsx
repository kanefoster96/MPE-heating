import Link from "next/link";
import { LIVE_CHAT_ON } from "./ContactOptions";

// The header's live chat button: opens /messages, the live chat ported
// from Kanvas Academy. Hidden until the chat is switched on.
export function ChatButton() {
  if (!LIVE_CHAT_ON) return null;
  return (
    <Link
      href="/messages"
      aria-label="Live chat with MPE"
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-grey"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z" />
      </svg>
    </Link>
  );
}
