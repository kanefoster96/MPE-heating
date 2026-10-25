"use client";

import { useEffect, useRef, useState } from "react";
import {
  APPOINTMENT_KINDS,
  KIND_DEFAULT_MINUTES,
  KIND_LABEL,
  WINDOW_PRESETS,
  WORKDAY,
  toHHMM,
  type AppointmentKind,
} from "@/lib/day-plan";
import { searchCustomerOptions, type CustomerOption } from "@/app/staff/schedule/actions";

export type AppointmentFormValues = {
  kind: AppointmentKind;
  day: string;
  start: number;
  end: number;
  customer: { id: string; label: string } | null;
  enquiryId: string | null;
  title: string;
  address: string;
  postcode: string;
  notes: string;
};

const FIELD =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";
const LABEL = "text-sm text-muted";

/**
 * Adding or editing a visit: what kind, which day, a rough window, who for
 * and any notes. Picking a kind sets its usual window (lib/day-plan.ts) until
 * the window's been set by hand; the presets set morning, afternoon or all
 * day. The customer is picked by searching, or added right here.
 */
export function AppointmentForm({
  action,
  initial,
  submitLabel,
  onCancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: AppointmentFormValues;
  submitLabel: string;
  onCancelHref?: string;
}) {
  const [kind, setKind] = useState<AppointmentKind>(initial.kind);
  const [start, setStart] = useState(toHHMM(initial.start));
  const [end, setEnd] = useState(toHHMM(initial.end));
  const windowTouched = useRef(false);
  const [customer, setCustomer] = useState(initial.customer);
  const [address, setAddress] = useState(initial.address);
  const [postcode, setPostcode] = useState(initial.postcode);
  const [newCustomer, setNewCustomer] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchCustomerOptions(q);
        if (live) setOptions(found);
      } finally {
        if (live) setSearching(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  function chooseKind(next: AppointmentKind) {
    setKind(next);
    if (windowTouched.current) return;
    const from = Math.min(Math.max(toMinutes(start), WORKDAY.start), WORKDAY.end - 60);
    const length = KIND_DEFAULT_MINUTES[next];
    const s = length >= WORKDAY.end - WORKDAY.start ? WORKDAY.start : from;
    setStart(toHHMM(s));
    setEnd(toHHMM(Math.min(s + length, 24 * 60)));
  }

  function pick(option: CustomerOption) {
    setCustomer({ id: option.id, label: option.label });
    if (!address && option.address) setAddress(option.address);
    if (!postcode && option.postcode) setPostcode(option.postcode);
    setQuery("");
    setOptions([]);
  }

  return (
    <form action={action} className="flex flex-col gap-5" data-appointment-form>
      <input type="hidden" name="enquiryId" value={initial.enquiryId ?? ""} />
      <input type="hidden" name="customerId" value={customer?.id ?? ""} />

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL}>What kind of visit</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {APPOINTMENT_KINDS.map((k) => (
            <label
              key={k}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground/40 ${
                kind === k ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => chooseKind(k)} className="sr-only" />
              {KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Day</span>
          <input type="date" name="day" required defaultValue={initial.day} className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>From</span>
          <input
            type="time"
            name="start"
            required
            step={900}
            value={start}
            onChange={(e) => {
              windowTouched.current = true;
              setStart(e.target.value);
            }}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>To</span>
          <input
            type="time"
            name="end"
            required
            step={900}
            value={end}
            onChange={(e) => {
              windowTouched.current = true;
              setEnd(e.target.value);
            }}
            className={FIELD}
          />
        </label>
      </div>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {WINDOW_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              windowTouched.current = true;
              setStart(toHHMM(p.start));
              setEnd(toHHMM(p.end));
            }}
            className="min-h-9 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL}>Customer</span>
        {customer ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
            <span className="truncate text-sm font-medium" data-picked-customer>
              {customer.label}
            </span>
            <button type="button" onClick={() => setCustomer(null)} className="min-h-9 shrink-0 px-2 text-sm text-muted underline underline-offset-4 hover:text-foreground">
              Change
            </button>
          </div>
        ) : newCustomer ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
            <input name="newName" placeholder="Name" autoComplete="off" className={FIELD} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="newPhone" type="tel" inputMode="tel" placeholder="Mobile" autoComplete="off" className={FIELD} />
              <input name="newEmail" type="email" placeholder="Email" autoComplete="off" className={FIELD} />
            </div>
            <button type="button" onClick={() => setNewCustomer(false)} className="self-start text-sm text-muted underline underline-offset-4 hover:text-foreground">
              Search customers instead
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setOptions([]);
              }}
              placeholder="Search by name, phone, email or postcode"
              aria-label="Search customers"
              autoComplete="off"
              className={FIELD}
            />
            {(options.length > 0 || (query.trim().length >= 2 && !searching)) && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-background shadow-lg">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => pick(o)} className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-surface">
                      <span className="text-sm font-medium">{o.label}</span>
                      {o.sub && <span className="text-xs text-muted">{o.sub}</span>}
                    </button>
                  </li>
                ))}
                {options.length === 0 && <li className="px-4 py-2.5 text-sm text-muted">No customers match.</li>}
              </ul>
            )}
            <button type="button" onClick={() => setNewCustomer(true)} className="mt-2 min-h-9 text-sm font-medium text-accent underline underline-offset-4">
              + New customer
            </button>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>
          Title <span className="text-muted">(for anything without a customer, e.g. van MOT)</span>
        </span>
        <input name="title" defaultValue={initial.title} maxLength={120} className={FIELD} />
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Address</span>
          <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Postcode</span>
          <input name="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} className={FIELD} />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>
          Notes <span className="text-muted">(only the team sees these)</span>
        </span>
        <textarea name="notes" defaultValue={initial.notes} rows={3} className={FIELD} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="min-h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:opacity-75"
        >
          {submitLabel}
        </button>
        {onCancelHref && (
          <a href={onCancelHref} className="min-h-11 content-center px-2 text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Cancel
          </a>
        )}
      </div>
    </form>
  );
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
