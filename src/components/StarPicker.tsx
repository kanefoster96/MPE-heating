"use client";

import { useState } from "react";

const WORDS = ["", "Poor", "Not great", "OK", "Good", "Excellent"];

/** Five big stars as radio buttons (name "rating"): tap to rate, with the word for it underneath. */
export function StarPicker() {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset data-star-picker>
      <legend className="sr-only">Your rating</legend>
      <div className="flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-1" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name="rating"
              value={n}
              required
              checked={value === n}
              onChange={() => setValue(n)}
              className="peer sr-only"
            />
            <span className="sr-only">{`${n} star${n === 1 ? "" : "s"}`}</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`h-11 w-11 transition-transform peer-focus-visible:scale-110 peer-focus-visible:drop-shadow ${n <= shown ? "text-sun" : "text-line"}`}
            >
              <path
                fill="currentColor"
                stroke={n <= shown ? "#b45309" : "#c9c4bd"}
                strokeWidth="1"
                d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
              />
            </svg>
          </label>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-semibold text-navy" aria-live="polite">
        {WORDS[shown]}
      </p>
    </fieldset>
  );
}
