"use client";

import { useState } from "react";

// Calls our own /api/address-lookup route (never the address provider
// directly — that keeps the real API key server-side). See that route for
// how it's configured.
//   configured: false  -> no API key set at all (only possible in
//                         production without IDEAL_POSTCODES_API_KEY)
//   unavailable: true  -> key is set but out of credit or rate-limited —
//                         not the postcode's fault, so this gets its own
//                         message rather than implying nothing was found
async function lookupAddress(
  postcode: string
): Promise<{ addresses: string[]; configured: boolean; unavailable: boolean }> {
  try {
    const res = await fetch(`/api/address-lookup?postcode=${encodeURIComponent(postcode)}`);
    const data = await res.json();
    return {
      addresses: data.addresses ?? [],
      configured: data.configured ?? true,
      unavailable: data.unavailable ?? false,
    };
  } catch {
    return { addresses: [], configured: true, unavailable: false };
  }
}

export function AddressFinder({
  label,
  address,
  onAddressChange,
}: {
  label: string;
  address: string;
  onAddressChange: (value: string) => void;
}) {
  const [postcode, setPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const handleFind = async () => {
    if (!postcode.trim()) return;
    setSearching(true);
    const { addresses, configured, unavailable } = await lookupAddress(postcode);
    setSearching(false);
    setResults(addresses);
    setConfigured(configured);
    setUnavailable(unavailable);
  };

  return (
    <div>
      <label htmlFor="postcode" className="mb-1.5 block text-sm font-semibold text-navy">
        {label}
      </label>

      <div className="flex gap-2">
        <input
          id="postcode"
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleFind();
            }
          }}
          placeholder="Postcode"
          autoComplete="postal-code"
          className="w-32 shrink-0 rounded-2xl border border-line px-4 py-3 text-base text-navy outline-none transition-colors focus:border-terracotta sm:w-40"
        />
        <button
          type="button"
          onClick={handleFind}
          disabled={searching || !postcode.trim()}
          className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-50"
        >
          {searching ? "Searching…" : "Find address"}
        </button>
      </div>

      {results && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {results.map((result) => (
            <li key={result}>
              <button
                type="button"
                onClick={() => {
                  onAddressChange(result);
                  setResults(null);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-navy hover:bg-grey"
              >
                {result}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results && results.length === 0 && (
        <p className="mt-2 text-xs text-navy/50">
          {unavailable
            ? "Address lookup is temporarily unavailable — enter your address below."
            : configured
              ? "No addresses found for that postcode — check it, or enter your address below."
              : "Address lookup isn't set up yet — enter your address below."}
        </p>
      )}

      <input
        type="text"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Full address"
        autoComplete="street-address"
        className="mt-2 w-full rounded-2xl border border-line px-4 py-3 text-base text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-terracotta"
      />
    </div>
  );
}
