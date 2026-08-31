import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: string[];
  error?: string;
};

export function SelectField({ label, options, error, id, className, ...selectProps }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-base text-navy outline-none transition-colors focus:border-terracotta ${
          error ? "border-terracotta" : "border-line"
        } ${className ?? ""}`}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
