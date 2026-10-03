import { fee } from "@/lib/content";
import { PriceTagIcon } from "./icons";

// The £50 call-out, explained. Sits under every booking ask so the deal is
// clear before anyone books. `compact` is the one-line version for tight
// spots; the full version lists the three lines.
export function FeeNote({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <p className={`inline-flex items-center gap-2 text-sm font-semibold text-navy ${className}`}>
        <PriceTagIcon className="h-4 w-4 shrink-0" />
        {fee.short}
      </p>
    );
  }
  return (
    <div className={`rounded-2xl border border-line bg-cream px-5 py-4 text-left ${className}`}>
      <p className="flex items-center gap-2 text-sm font-bold text-navy">
        <PriceTagIcon className="h-4 w-4 shrink-0" />
        {fee.title}
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-sm leading-relaxed text-text-2">
        {fee.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
