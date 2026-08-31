"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/content";
import { calloutConfirmationEmail } from "@/lib/emails";
import { SITE_URL } from "@/lib/seo";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  PhoneIcon,
} from "@/components/icons";

type Booking = {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  sameDayRequested: boolean;
  submittedAgo: string;
  status: "new" | "confirmed";
  calloutDate?: string;
  timeWindow?: string;
};

const TIME_WINDOWS = ["8am – 11am", "11am – 2pm", "2pm – 5pm", "5pm – 7pm"];

// Placeholder bookings so this screen is demoable before Supabase exists —
// swap for a real `bookings` query (see supabase/migrations/…) once it
// does. Not real customers.
const MOCK_BOOKINGS: Booking[] = [
  {
    id: "1",
    name: "Sarah Thompson",
    phone: "07911 123456",
    email: "sarah.t@example.com",
    message: "No hot water since this morning, radiators are cold too.",
    sameDayRequested: true,
    submittedAgo: "12 minutes ago",
    status: "new",
  },
  {
    id: "2",
    name: "Mark Reid",
    phone: "07700 900123",
    email: "",
    message: "Boiler's making a loud banging noise whenever the heating kicks in.",
    sameDayRequested: false,
    submittedAgo: "1 hour ago",
    status: "new",
  },
  {
    id: "3",
    name: "Priya Kaur",
    phone: "07822 456789",
    email: "priya.k@example.com",
    message: "Pressure keeps dropping every few days, topped it up twice this month.",
    sameDayRequested: false,
    submittedAgo: "Yesterday",
    status: "confirmed",
    calloutDate: "2026-09-02",
    timeWindow: "11am – 2pm",
  },
];

// TODO(stripe): the real payment link should be a Stripe Checkout Session
// (setup_future_usage: "off_session" so the card is saved AND the £50 is
// charged in one step) created server-side when the callout is confirmed
// — this placeholder goes nowhere yet.
// TODO(resend): actually send the email via the Resend API instead of
// just rendering a preview of it here.
async function confirmCalloutStub(_args: {
  bookingId: string;
  calloutDate: string;
  timeWindow: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { error: null };
}

export function CalloutsAdmin() {
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [calloutDate, setCalloutDate] = useState("");
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0]);
  const [sending, setSending] = useState(false);
  const [previewFor, setPreviewFor] = useState<Booking | null>(null);

  const openConfirm = (booking: Booking) => {
    setOpenId(booking.id);
    setCalloutDate("");
    setTimeWindow(TIME_WINDOWS[0]);
    setPreviewFor(null);
  };

  const handleConfirm = async (booking: Booking) => {
    if (!calloutDate) return;
    setSending(true);
    await confirmCalloutStub({ bookingId: booking.id, calloutDate, timeWindow });
    setSending(false);

    const confirmed: Booking = { ...booking, status: "confirmed", calloutDate, timeWindow };
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? confirmed : b)));
    setPreviewFor(confirmed);
  };

  return (
    <div className="min-h-screen bg-cream px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} className="h-8 w-auto" />
          <Link href="/" className="text-sm font-medium text-navy/50 hover:text-navy">
            ← Back to site
          </Link>
        </div>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Confirm callouts
        </h1>
        <p className="mt-2 text-sm text-navy/70">
          Pick a customer, agree a time by phone first, then confirm here — it sends them the
          date, time window, and a £50 confirm-and-save-card link.
        </p>

        <div className="mt-4 rounded-2xl bg-terracotta-light px-4 py-3 text-sm text-terracotta-dark">
          Preview only — not connected to Supabase, Stripe or Resend yet. The bookings below are
          mock data, and nothing here actually sends an email or takes a payment.
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-[24px] bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-navy">{booking.name}</p>
                    {booking.sameDayRequested && (
                      <span className="rounded-full bg-terracotta-light px-2.5 py-0.5 text-xs font-semibold text-terracotta-dark">
                        Same-day requested
                      </span>
                    )}
                    {booking.status === "confirmed" && (
                      <span className="rounded-full bg-grey px-2.5 py-0.5 text-xs font-semibold text-navy/60">
                        Confirmed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/60">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {booking.phone}
                    {booking.email && <span> · {booking.email}</span>}
                  </p>
                  <p className="mt-2 text-sm text-navy/80">{booking.message}</p>
                </div>
                <p className="shrink-0 text-xs text-navy/40">{booking.submittedAgo}</p>
              </div>

              {booking.status === "confirmed" && booking.calloutDate ? (
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-navy">
                  <CalendarIcon className="h-4 w-4 text-terracotta" />
                  {booking.calloutDate} · {booking.timeWindow}
                </p>
              ) : openId === booking.id ? (
                <div className="mt-4 rounded-2xl border border-line p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`date-${booking.id}`} className="mb-1.5 block text-xs font-semibold text-navy">
                        Callout date
                      </label>
                      <input
                        id={`date-${booking.id}`}
                        type="date"
                        value={calloutDate}
                        onChange={(e) => setCalloutDate(e.target.value)}
                        className="w-full rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
                      />
                    </div>
                    <div>
                      <label htmlFor={`window-${booking.id}`} className="mb-1.5 block text-xs font-semibold text-navy">
                        Time window
                      </label>
                      <select
                        id={`window-${booking.id}`}
                        value={timeWindow}
                        onChange={(e) => setTimeWindow(e.target.value)}
                        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
                      >
                        {TIME_WINDOWS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-xs text-navy/60">
                    <CreditCardIcon className="h-3.5 w-3.5" />
                    They&apos;ll need to pay £50 and save a card on file to confirm.
                  </p>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirm(booking)}
                      disabled={!calloutDate || sending}
                      className="bg-btn-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <CheckIcon className="h-4 w-4" />
                      {sending ? "Sending…" : "Confirm callout"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy/70 hover:bg-grey"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openConfirm(booking)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
                >
                  <ClockIcon className="h-4 w-4" />
                  Confirm callout
                </button>
              )}

              {previewFor?.id === booking.id && (
                <EmailPreview booking={previewFor} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ booking }: { booking: Booking }) {
  if (!booking.calloutDate || !booking.timeWindow) return null;

  const { subject, html } = calloutConfirmationEmail({
    name: booking.name,
    calloutDate: booking.calloutDate,
    timeWindow: booking.timeWindow,
    // Placeholder — see TODO(stripe) above the confirmCalloutStub function.
    paymentLink: `${SITE_URL}/pay/${booking.id}`,
  });

  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">
        Email preview — &ldquo;{subject}&rdquo;
      </p>
      <iframe
        srcDoc={html}
        title={`Callout confirmation email preview for ${booking.name}`}
        className="mt-3 h-[440px] w-full rounded-xl border border-line"
      />
    </div>
  );
}
