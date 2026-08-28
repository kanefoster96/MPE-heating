"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import { getPasswordStrength } from "@/lib/validation";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  showStrength = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "new-password" | "current-password";
  showStrength?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? getPasswordStrength(value) : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-2xl border px-4 py-3 pr-11 text-sm text-navy outline-none transition-colors focus:border-terracotta ${
            error ? "border-terracotta" : "border-line"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>

      {showStrength && value && strength && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= strength.score - 1 ? strength.color : "bg-grey"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs font-medium text-navy/50">{strength.label}</p>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
