import type { ReactNode } from "react";

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
