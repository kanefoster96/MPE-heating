// A small pulsing dot and one line, such as "Same-day repairs across the
// North East". The dot's pulse is the only looping motion on the page.
export function StatusLine({ children, className = "" }: { children: string; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2.5 text-sm font-medium text-text-2 ${className}`}>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="pulse-soft absolute inline-flex h-full w-full rounded-full bg-navy" />
        <span className="relative inline-flex h-full w-full rounded-full bg-navy" />
      </span>
      {children}
    </p>
  );
}
