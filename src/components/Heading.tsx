import type { ReactNode } from "react";

// Two-tone heading: the first clause plain navy, the second carrying the
// orange gradient, always starting on its own line. One emphasis per
// heading, nothing else styled. The block wrapper around the inline
// gradient span keeps the gradient hugging the text and lets the line
// centre with the heading.
export function Heading({
  as: Tag = "h2",
  lead,
  em,
  emLine = true,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  lead: ReactNode;
  em?: ReactNode;
  emLine?: boolean;
  className?: string;
}) {
  return (
    <Tag className={`font-extrabold leading-[1.05] tracking-tight text-navy ${className}`}>
      {lead}
      {em &&
        (emLine ? (
          <span className="block">
            <span className="em">{em}</span>
          </span>
        ) : (
          <>
            {" "}
            <span className="em">{em}</span>
          </>
        ))}
    </Tag>
  );
}

// Small quiet label above a heading. Grey, not orange: colour is rare.
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.18em] text-text-3 ${className}`}>
      {children}
    </p>
  );
}
