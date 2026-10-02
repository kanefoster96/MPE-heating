import type { ReactNode } from "react";

// A notification pill: a round icon on the left, a bold line and a lighter
// second line. 50px tall with generous padding after the text.
export function Chip({
  icon,
  title,
  sub,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div
      className={`chip inline-flex h-[50px] items-center gap-3 whitespace-nowrap rounded-full border border-line bg-white pl-[9px] pr-[22px] shadow-[0_8px_20px_-14px_rgba(31,42,58,0.35)] ${className}`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-white [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="leading-tight">
        <b className="block text-[13px] font-semibold text-navy">{title}</b>
        {sub && <small className="block text-xs text-text-2">{sub}</small>}
      </span>
    </div>
  );
}

// A rounded square holding one line icon. The main one is navy with a
// white icon; the rest are grey with a navy icon.
export function IconTile({
  icon,
  primary = false,
  className = "",
}: {
  icon: ReactNode;
  primary?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`grid h-[52px] w-[52px] place-items-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6 ${
        primary ? "bg-navy text-white" : "bg-grey text-navy"
      } ${className}`}
    >
      {icon}
    </div>
  );
}
