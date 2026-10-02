import type { ReactNode } from "react";

// Two-tone heading: the first clause plain navy, the second carrying the
// orange gradient. One emphasis per heading, nothing else styled. When
// the emphasised clause is long, `emLine` puts it on its own line (as a
// block wrapper around the inline gradient span, so the gradient still
// hugs the text and the line centres with the heading).
export function Heading({
  as: Tag = "h2",
  lead,
  em,
  emLine = false,
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
