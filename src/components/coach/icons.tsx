// The staff screens' icons, from Kanvas Academy (its components/icons.tsx and
// components/coach/icons.tsx): viewBox 20x20, currentColor stroke, 1.5 weight.

type IconProps = { className?: string };

const base = "h-4 w-4 shrink-0";

export function UndoIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M6.25 5.5L3.5 8.25l2.75 2.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 8.25h8a4.25 4.25 0 1 1 0 8.5H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BackArrowIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M12 15.5L6.5 10l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaperPlaneIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M17 3L2.75 9.25l5.5 2.25 2.25 5.5L17 3Z" strokeLinejoin="round" />
      <path d="M8.25 11.5L17 3" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="1.75" />
      <path d="M6.5 9V6.5a3.5 3.5 0 1 1 7 0V9" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M4 10.5l3.75 3.75L16 5.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

