import Link from "next/link";
import { business } from "@/lib/content";
import { bookHref, resolvePath } from "@/lib/funnel";
import { funnelIconMap } from "@/lib/funnelIcons";
import { ArrowRightIcon } from "./icons";

// The commercial ask: what it's for, picked up front. One row per job in
// the booking funnel's commercial branch (lib/funnel.ts), each opening its
// own form; a breakdown first, as the urgent one. Then the number.
export function CommercialPicker({ className = "" }: { className?: string }) {
  const options = resolvePath(["commercial"])?.[0]?.children ?? [];
  return (
    <div className={`w-full max-w-xl text-left ${className}`}>
      <p className="text-center text-sm font-semibold text-text-2">What do you need?</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {options.map((node) => {
          const Icon = funnelIconMap[node.icon];
          const urgent = node.leaf?.sameDay === true;
          return (
            <li key={node.id}>
              <Link
                href={bookHref(["commercial", node.id])}
                data-commercial={node.id}
                className={`flex min-h-16 items-center gap-3.5 rounded-2xl border p-3.5 transition-colors ${
                  urgent ? "border-terracotta-deep/40 bg-[#fff0e6] hover:border-terracotta-deep" : "border-line bg-white hover:border-navy/40"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${urgent ? "bg-terracotta-deep text-white" : "bg-cream text-navy"}`}
                >
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-snug">{node.label}</span>
                  <span className="block text-sm leading-snug text-text-2">{node.text}</span>
                  {node.leaf?.cta && <span className={`mt-1 block text-sm font-semibold ${urgent ? "text-terracotta-deep" : "text-navy"}`}>{node.leaf.cta}</span>}
                </span>
                <ArrowRightIcon className="h-5 w-5 flex-none text-text-3" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-center text-sm text-text-2">
        Stopped trading right now? Call{" "}
        <a href={business.phoneHref} className="inline-flex min-h-11 items-center font-semibold text-navy underline underline-offset-4">
          {business.phoneDisplay}
        </a>
      </p>
    </div>
  );
}
