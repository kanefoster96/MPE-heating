import { LIVE_CHAT_ON } from "./ContactOptions";

// The header's live chat button. Kanvas One's chat.js (loaded in the
// layout once the site's One id is set) finds it by id, shows it and opens
// the chat from it, so there's no floating bubble in the corner.
export function ChatButton() {
  if (!LIVE_CHAT_ON) return null;
  return (
    <button
      id="chatButton"
      type="button"
      hidden
      aria-label="Live chat with MPE"
      className="relative h-11 w-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-grey [&:not([hidden])]:inline-flex"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z" />
      </svg>
    </button>
  );
}
