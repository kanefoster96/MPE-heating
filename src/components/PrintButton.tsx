"use client";

/** Prints the page (or saves it as a PDF from the print dialog). */
export function PrintButton({ label = "Print or save as PDF", className = "" }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
