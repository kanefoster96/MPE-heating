"use client";

import { useState } from "react";

// TODO(address-api): wire this up to a real UK address lookup provider once
// there's an API key for one — e.g. getAddress.io, Ideal Postcodes, or
// Loqate. Royal Mail's address data (PAF) is commercially licensed, so
// there's no free way to turn a postcode into a real list of properties;
// every UK provider that does this is a paid API. Typical shape:
//   GET https://api.getaddress.io/find/{postcode}?api-key=...
// returning an array of formatted address lines — that's what actually gets
// an exact property, since a postcode alone only narrows it to a street or
// two. Until then this always returns no results and falls back to manual
// entry below, which keeps the form fully usable either way.
async function lookupAddressStub(_postcode: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return [];
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

  const handleFind = async () => {
    if (!postcode.trim()) return;
    setSearching(true);
    const found = await lookupAddressStub(postcode);
    setSearching(false);
    setResults(found);
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
          className="w-32 shrink-0 rounded-2xl border border-line px-4 py-3 text-sm text-navy outline-none transition-colors focus:border-terracotta sm:w-40"
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
          Address lookup isn&rsquo;t connected yet — enter your address below.
        </p>
      )}

      <input
        type="text"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Full address"
        autoComplete="street-address"
        className="mt-2 w-full rounded-2xl border border-line px-4 py-3 text-sm text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-terracotta"
      />
    </div>
  );
}
