"use client";

import { useState } from "react";

// Calls our own /api/address-lookup route (never the address provider
// directly — that keeps the real API key server-side). See that route for
// how it's configured. `configured: false` means no API key is set at all
// (only possible in production without IDEAL_POSTCODES_API_KEY); anything
// else just means no addresses were found for that postcode.
async function lookupAddress(postcode: string): Promise<{ addresses: string[]; configured: boolean }> {
  try {
    const res = await fetch(`/api/address-lookup?postcode=${encodeURIComponent(postcode)}`);
    const data = await res.json();
    return { addresses: data.addresses ?? [], configured: data.configured ?? true };
  } catch {
    return { addresses: [], configured: true };
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

  const handleFind = async () => {
    if (!postcode.trim()) return;
    setSearching(true);
    const { addresses, configured } = await lookupAddress(postcode);
    setSearching(false);
    setResults(addresses);
    setConfigured(configured);
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
          {configured
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
