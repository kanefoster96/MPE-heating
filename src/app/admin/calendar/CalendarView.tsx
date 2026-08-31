"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { MOCK_BOOKINGS, MOCK_CUSTOMERS } from "../mockData";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const CALLOUT_BOOKINGS = MOCK_BOOKINGS.filter(
  (b) => (b.status === "confirmed" || b.status === "completed") && b.calloutDate
);

export function CalendarView() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Calendar</h1>
      <p className="mt-2 text-sm text-navy/70">
        Every confirmed callout, so nothing gets double-booked. Reschedule from Requests & jobs.
      </p>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-navy hover:bg-grey"
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-navy">{weekLabel}</p>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-navy hover:bg-grey"
          aria-label="Next week"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((date, i) => {
          const iso = toISODate(date);
          const dayBookings = CALLOUT_BOOKINGS.filter((b) => b.calloutDate === iso);
          const isToday = iso === toISODate(new Date());

          return (
            <div
              key={iso}
              className={`rounded-2xl bg-white p-3 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] ${
                isToday ? "ring-2 ring-terracotta" : ""
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-navy/40">
                {DAY_LABELS[i]} {date.getDate()}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {dayBookings.length === 0 && <p className="text-xs text-navy/30">—</p>}
                {dayBookings.map((booking) => {
                  const customer = MOCK_CUSTOMERS.find((c) => c.id === booking.customerId);
                  return (
                    <Link
                      key={booking.id}
                      href={`/admin/customers/${booking.customerId}`}
                      className={`block rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                        booking.status === "completed"
                          ? "bg-grey text-navy/60"
                          : "bg-terracotta-light text-terracotta-dark hover:bg-terracotta-light/70"
                      }`}
                    >
                      {booking.timeWindow}
                      <br />
                      {customer?.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
