export type AccountType = "personal" | "business";

export function AccountTypeToggle({
  value,
  onChange,
}: {
  value: AccountType;
  onChange: (value: AccountType) => void;
}) {
  return (
    <div className="relative flex rounded-full bg-grey p-1">
      <div
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_2px_6px_rgba(31,42,58,0.15)] transition-transform duration-200 ease-out ${
          value === "business" ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <button
        type="button"
        onClick={() => onChange("personal")}
        aria-pressed={value === "personal"}
        className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
          value === "personal" ? "text-navy" : "text-navy/50 hover:text-navy/70"
        }`}
      >
        Personal
      </button>
      <button
        type="button"
        onClick={() => onChange("business")}
        aria-pressed={value === "business"}
        className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
          value === "business" ? "text-navy" : "text-navy/50 hover:text-navy/70"
        }`}
      >
        Business
      </button>
    </div>
  );
}
