"use client";

import { useEffect, useState } from "react";
import { londonNow } from "@/lib/schedule-time";
import { PART_LABEL, PARTS, addDays, isISODate, type Part } from "@/lib/day-plan";

export type DayPart = { day: string; part: Part | "" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The next `count` days, London time, from today or tomorrow. */
export function upcomingDays(count: number, fromToday: boolean): string[] {
  const today = londonNow().dateISO;
  return Array.from({ length: count }, (_, i) => addDays(today, i + (fromToday ? 0 : 1)));
}

function chipLabel(iso: string, today: string): { top: string; bottom: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  const bottom = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (iso === today) return { top: "Today", bottom };
  if (iso === addDays(today, 1)) return { top: "Tomorrow", bottom };
  return { top: WEEKDAYS[d.getUTCDay()], bottom };
}

const CHIP =
  "flex min-h-12 shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const ON = "border-terracotta-deep bg-terracotta-deep text-white";
const OFF = "border-line bg-white text-navy hover:border-navy/40";

/**
 * Pick a day in the next two weeks, then morning, afternoon or any time:
 * how a customer asks for a visit (booking forms, their account) or for
 * another time (their visit page). A row of day chips that scrolls sideways
 * on a phone, then three part-of-day chips. Days off (lib/days-off.ts)
 * aren't offered. Controlled; `DayPartFields` wraps it for a plain form.
 */
export function DayPartPicker({
  value,
  onChange,
  fromToday = false,
  days = 14,
}: {
  value: DayPart;
  onChange: (next: DayPart) => void;
  fromToday?: boolean;
  days?: number;
}) {
  const [today] = useState(() => londonNow().dateISO);
  const [all] = useState(() => upcomingDays(days, fromToday));
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let live = true;
    fetch("/api/closed-days")
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d: { days?: string[] }) => {
        if (live) setClosed(new Set(d.days ?? []));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    // A day picked before the days off arrived (or saved in a draft) that turns out to be one.
    if (value.day && closed.has(value.day)) onChange({ ...value, day: "" });
  }, [closed, value, onChange]);
  const list = all.filter((d) => !closed.has(d));
  return (
    <div className="flex flex-col gap-4" data-day-part>
      <div>
        <p className="mb-2 text-sm font-semibold text-navy" id="pick-day">
          Which day?
        </p>
        <div role="radiogroup" aria-labelledby="pick-day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {list.map((iso) => {
            const { top, bottom } = chipLabel(iso, today);
            const on = value.day === iso;
            return (
              <button
                key={iso}
                type="button"
                role="radio"
                aria-checked={on}
                data-day={iso}
                onClick={() => onChange({ ...value, day: iso })}
                className={`${CHIP} min-w-[4.5rem] ${on ? ON : OFF}`}
              >
                <span className="font-semibold">{top}</span>
                <span className={`text-xs ${on ? "text-white" : "text-text-2"}`}>{bottom}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-navy" id="pick-part">
          What time of day?
        </p>
        <div role="radiogroup" aria-labelledby="pick-part" className="grid grid-cols-3 gap-2">
          {PARTS.map((p) => {
            const on = value.part === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                data-part={p}
                onClick={() => onChange({ ...value, part: p })}
                className={`${CHIP} font-semibold ${on ? ON : OFF}`}
              >
                {PART_LABEL[p]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The picker as form fields (`day` and `part`) and a submit button that waits until both are picked. */
export function DayPartFields({
  fromToday = false,
  submitLabel,
  children,
}: {
  fromToday?: boolean;
  submitLabel: string;
  /** More fields, between the picker and the button. */
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState<DayPart>({ day: "", part: "" });
  const ready = isISODate(value.day) && !!value.part;
  return (
    <>
      <input type="hidden" name="day" value={value.day} />
      <input type="hidden" name="part" value={value.part} />
      <DayPartPicker value={value} onChange={setValue} fromToday={fromToday} />
      {children}
      <button
        type="submit"
        disabled={!ready}
        className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </>
  );
}
