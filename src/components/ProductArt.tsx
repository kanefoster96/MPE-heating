import type { ReactNode } from "react";

/**
 * Placeholder product/illustration art: a white rounded panel with a
 * centred line icon and a soft drop shadow, standing in for real photography
 * (per the "clean cut-out on a flat colour" imagery rule) until product/site
 * photos are supplied.
 */
export function ProductArt({
  icon,
  size = "md",
  className = "",
}: {
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-28 w-28 [&_svg]:h-10 [&_svg]:w-10",
    md: "h-40 w-40 [&_svg]:h-16 [&_svg]:w-16",
    lg: "h-56 w-56 [&_svg]:h-24 [&_svg]:w-24",
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center rounded-[28px] bg-white text-navy shadow-[0_20px_45px_-15px_rgba(31,42,58,0.35)] ${sizeClasses} ${className}`}
    >
      {icon}
    </div>
  );
}
