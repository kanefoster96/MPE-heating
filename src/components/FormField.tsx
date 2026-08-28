import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function FormField({ label, error, id, className, ...inputProps }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-2xl border px-4 py-3 text-sm text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-terracotta ${
          error ? "border-terracotta" : "border-line"
        } ${className ?? ""}`}
        {...inputProps}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
