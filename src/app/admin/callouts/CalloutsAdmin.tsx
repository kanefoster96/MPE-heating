"use client";

import { useState } from "react";
import Link from "next/link";
import {
  calloutConfirmationEmail,
  calloutRescheduledEmail,
  invoiceEmail,
  replyEmail,
} from "@/lib/emails";
import { SITE_URL } from "@/lib/seo";
import { mailtoHref, telHref, waHref } from "@/lib/contactLinks";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/icons";
import {
  MOCK_BOOKINGS,
  MOCK_CUSTOMERS,
  MOCK_UNMATCHED_PAYMENTS,
  PAYMENT_METHOD_LABELS,
  TIME_WINDOWS,
  type BookingSource,
  type MockBooking,
  type MockCustomer,
  type MockUnmatchedPayment,
} from "../mockData";

type PanelType = "reply" | "confirm" | "reschedule" | "complete";
type OpenPanel = { bookingId: string; type: PanelType } | null;

const SOURCE_LABELS: Record<BookingSource, string> = {
  form: "form",
  phone: "phone",
  whatsapp: "WhatsApp",
  email: "email",
};

// Phrasing for the auto-generated "Added by Fergal…" fallback message —
// "over the phone" takes an article, "over WhatsApp"/"over email" don't.
const SOURCE_OVER_PHRASE: Record<BookingSource, string> = {
  form: "via the form",
  phone: "over the phone",
  whatsapp: "over WhatsApp",
  email: "over email",
};

// TODO(stripe): the real payment link should be a Stripe Checkout Session
// (setup_future_usage: "off_session" so the card is saved AND the £50 is
// charged in one step) created server-side when the callout is confirmed
// — this placeholder goes nowhere yet.
// TODO(resend): actually send the email via the Resend API instead of
// just rendering a preview of it here. Applies to every stub below too.
async function confirmCalloutStub(_args: {
  bookingId: string;
  calloutDate: string;
  timeWindow: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

async function replyAndCloseStub(_args: {
  bookingId: string;
  message: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

async function addJobManuallyStub(_args: {
  name: string;
  phone: string;
  email: string;
  message: string;
  source: BookingSource;
  calloutDate: string;
  timeWindow: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

// TODO(stripe): "card" charges an off-session PaymentIntent against
// stripe_customers.stripe_customer_id. "invoice" creates a Stripe-hosted
// invoice and emails the link. Neither touches Stripe yet.
async function markCompleteStub(_args: {
  bookingId: string;
  notes: string;
  method: "card" | "invoice" | "tap";
  amountPence: number;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { error: null };
}

// The write-up prompted by a Stripe-app payment landing via the webhook
// (src/app/api/stripe-webhook/route.ts sets payments.needs_notes).
// TODO(supabase): insert into job_notes (customer-readable on their
// account, per the RLS in the migration) and clear needs_notes on the
// payment that prompted this.
async function saveJobNotesStub(_args: {
  bookingId: string;
  notes: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

// Attaches a webhook payment that arrived with no recognisable customer
// (profile_id null — see the webhook route and migration).
// TODO(supabase): update the payments row's profile_id; link and complete
// the customer's most recent confirmed booking if they have one; and when
// the row carries a stripe_customer_id this database didn't know,
// backfill stripe_customers with the mapping so that customer's next
// payment matches automatically.
async function assignPaymentStub(_args: {
  paymentId: string;
  customerId: string;
}): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { error: null };
}

export function CalloutsAdmin() {
  const [customers, setCustomers] = useState<MockCustomer[]>(MOCK_CUSTOMERS);
  const [bookings, setBookings] = useState<MockBooking[]>(MOCK_BOOKINGS);
  const [unmatched, setUnmatched] = useState<MockUnmatchedPayment[]>(MOCK_UNMATCHED_PAYMENTS);
  const [tab, setTab] = useState<"requests" | "jobs">("requests");
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [addingJob, setAddingJob] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; html: string } | null>(null);

  const customerFor = (booking: MockBooking) => customers.find((c) => c.id === booking.customerId);

  const requests = bookings.filter((b) => b.status === "new" || b.status === "answered");
  const jobs = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "completed" || b.status === "cancelled"
  );

  const confirmedBookingsOnDate = (date: string, excludeId: string) =>
    bookings
      .filter(
        (b) =>
          b.id !== excludeId &&
          b.calloutDate === date &&
          (b.status === "confirmed" || b.status === "completed")
      )
      .map((b) => ({ name: customerFor(b)?.name ?? "Unknown", timeWindow: b.timeWindow }));

  const updateBooking = (id: string, patch: Partial<MockBooking>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const assignPayment = async (payment: MockUnmatchedPayment, customerId: string) => {
    await assignPaymentStub({ paymentId: payment.id, customerId });
    setUnmatched((prev) => prev.filter((p) => p.id !== payment.id));

    // Mirror what the real assignment does: the customer's most recent
    // confirmed booking becomes the paid, completed job — which raises
    // the usual "write up the job" prompt.
    const openJob = bookings.find((b) => b.customerId === customerId && b.status === "confirmed");
    if (openJob) {
      updateBooking(openJob.id, {
        status: "completed",
        amountChargedPence: payment.amountPence,
        paidVia: payment.method,
        needsNotes: true,
      });
      setTab("jobs");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
        Requests & jobs
      </h1>
      <p className="mt-2 text-sm text-navy/70">
        Everything that&apos;s come in — the form, a call, WhatsApp, or email — lands here. Reply and
        close a question, or confirm a callout to schedule it.
      </p>

      <div className="mt-4 rounded-2xl bg-terracotta-light px-4 py-3 text-sm text-terracotta-dark">
        Preview only — not connected to Supabase, Stripe or Resend yet. The data below is mock,
        and nothing here actually sends an email or takes a payment.
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="New requests"
          value={bookings.filter((b) => b.status === "new").length}
          onClick={() => setTab("requests")}
        />
        <StatCard
          label="Booked in"
          value={bookings.filter((b) => b.status === "confirmed").length}
          onClick={() => setTab("jobs")}
        />
        <StatCard
          label="Awaiting job notes"
          value={bookings.filter((b) => b.needsNotes).length}
          highlight
          onClick={() => setTab("jobs")}
        />
        <StatCard label="Unmatched payments" value={unmatched.length} highlight />
      </div>

      {unmatched.map((payment) => (
        <UnmatchedPaymentCard
          key={payment.id}
          payment={payment}
          customers={customers}
          onAssign={(customerId) => assignPayment(payment, customerId)}
        />
      ))}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("requests")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === "requests" ? "bg-navy text-white" : "text-navy/60 hover:bg-grey"
            }`}
          >
            Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("jobs")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === "jobs" ? "bg-navy text-white" : "text-navy/60 hover:bg-grey"
            }`}
          >
            Jobs ({jobs.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAddingJob((v) => !v)}
          className="bg-btn-gradient rounded-full px-4 py-1.5 text-sm font-semibold text-white"
        >
          {addingJob ? "Cancel" : "+ Add job manually"}
        </button>
      </div>

      {addingJob && (
        <AddJobPanel
          onClose={() => setAddingJob(false)}
          onAdded={(customer, booking) => {
            setCustomers((prev) => [...prev, customer]);
            setBookings((prev) => [booking, ...prev]);
            setAddingJob(false);
          }}
        />
      )}

      <div className="mt-6 flex flex-col gap-4">
        {(tab === "requests" ? requests : jobs).length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-navy/50">
            Nothing here right now.
          </p>
        )}

        {(tab === "requests" ? requests : jobs).map((booking) => {
          const customer = customerFor(booking);
          if (!customer) return null;

          return (
            <BookingCard
              key={booking.id}
              booking={booking}
              customer={customer}
              isOpen={openPanel?.bookingId === booking.id ? openPanel.type : null}
              onOpen={(type) => {
                setOpenPanel({ bookingId: booking.id, type });
                setPreviewEmail(null);
              }}
              onClose={() => setOpenPanel(null)}
              conflictsFor={(date) => confirmedBookingsOnDate(date, booking.id)}
              onReply={async (message) => {
                await replyAndCloseStub({ bookingId: booking.id, message });
                updateBooking(booking.id, { status: "answered" });
                setPreviewEmail(replyEmail({ name: customer.name, message }));
                setOpenPanel(null);
              }}
              onConfirm={async (date, timeWindow) => {
                await confirmCalloutStub({ bookingId: booking.id, calloutDate: date, timeWindow });
                updateBooking(booking.id, { status: "confirmed", calloutDate: date, timeWindow });
                setPreviewEmail(
                  calloutConfirmationEmail({
                    name: customer.name,
                    calloutDate: date,
                    timeWindow,
                    paymentLink: `${SITE_URL}/pay/${booking.id}`,
                  })
                );
                setOpenPanel(null);
              }}
              onReschedule={async (date, timeWindow) => {
                await confirmCalloutStub({ bookingId: booking.id, calloutDate: date, timeWindow });
                updateBooking(booking.id, { calloutDate: date, timeWindow });
                setPreviewEmail(calloutRescheduledEmail({ name: customer.name, calloutDate: date, timeWindow }));
                setOpenPanel(null);
              }}
              onComplete={async (notes, method, amountPence) => {
                await markCompleteStub({ bookingId: booking.id, notes, method, amountPence });
                updateBooking(booking.id, { status: "completed", amountChargedPence: amountPence });
                if (method === "invoice") {
                  setPreviewEmail(
                    invoiceEmail({
                      name: customer.name,
                      amountPence,
                      jobSummary: notes || "Thanks for having us out — here's your invoice.",
                      paymentLink: `${SITE_URL}/pay/${booking.id}`,
                    })
                  );
                }
                setOpenPanel(null);
              }}
              onSaveNotes={async (notes) => {
                await saveJobNotesStub({ bookingId: booking.id, notes });
                updateBooking(booking.id, { needsNotes: false });
              }}
              onCancelJob={() => {
                updateBooking(booking.id, { status: "cancelled" });
                setOpenPanel(null);
              }}
            />
          );
        })}
      </div>

      {previewEmail && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">
            Email preview — &ldquo;{previewEmail.subject}&rdquo;
          </p>
          <iframe
            srcDoc={previewEmail.html}
            title="Email preview"
            className="mt-3 h-[440px] w-full rounded-xl border border-line"
          />
        </div>
      )}
    </div>
  );
}

function AddJobPanel({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (customer: MockCustomer, booking: MockBooking) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState<BookingSource>("phone");
  const [date, setDate] = useState("");
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim() && phone.trim() && email.trim() && date;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await addJobManuallyStub({ name, phone, email, message, source, calloutDate: date, timeWindow });
    setSubmitting(false);

    const customerId = `manual-${Date.now()}`;
    onAdded(
      { id: customerId, name, phone, email, hasCardOnFile: false },
      {
        id: `booking-${Date.now()}`,
        customerId,
        message: message || `Added by Fergal — booked ${SOURCE_OVER_PHRASE[source]}.`,
        sameDayRequested: false,
        submittedAgo: "Just now",
        status: "confirmed",
        source,
        calloutDate: date,
        timeWindow,
      }
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-5">
      <p className="text-sm font-bold text-navy">Add a job Fergal took directly</p>
      <p className="mt-1 text-sm text-navy/70">
        For a call, WhatsApp message, or email — enter their details and the time you&apos;ve already
        agreed, and it goes straight to confirmed.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
        <input
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="col-span-2 rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as BookingSource)}
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        >
          <option value="phone">Phone call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value)}
          className="col-span-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <textarea
          placeholder="What's the problem? (optional)"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="col-span-2 resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
      </div>

      <p className="mt-3 text-xs text-navy/60">
        They&apos;ll get an email to confirm the date/time and pay the £50 — if they don&apos;t
        have an account yet, that email also prompts them to set one up.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canSubmit || submitting}
          className="bg-btn-gradient rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add & send confirmation"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy/70 hover:bg-grey"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  customer,
  isOpen,
  onOpen,
  onClose,
  conflictsFor,
  onReply,
  onConfirm,
  onReschedule,
  onComplete,
  onSaveNotes,
  onCancelJob,
}: {
  booking: MockBooking;
  customer: MockCustomer;
  isOpen: PanelType | null;
  onOpen: (type: PanelType) => void;
  onClose: () => void;
  conflictsFor: (date: string) => { name: string; timeWindow?: string }[];
  onReply: (message: string) => void;
  onConfirm: (date: string, timeWindow: string) => void;
  onReschedule: (date: string, timeWindow: string) => void;
  onComplete: (notes: string, method: "card" | "invoice" | "tap", amountPence: number) => void;
  onSaveNotes: (notes: string) => void | Promise<void>;
  onCancelJob: () => void;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/customers/${customer.id}`}
              className="text-base font-bold text-navy hover:text-terracotta"
            >
              {customer.name}
            </Link>
            {booking.sameDayRequested && (
              <span className="rounded-full bg-terracotta-light px-2.5 py-0.5 text-xs font-semibold text-terracotta-dark">
                Same-day requested
              </span>
            )}
            <StatusBadge status={booking.status} />
            {booking.source !== "form" && (
              <span className="rounded-full bg-grey px-2.5 py-0.5 text-xs font-semibold text-navy/60">
                via {SOURCE_LABELS[booking.source]}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/60">
            <PhoneIcon className="h-3.5 w-3.5" />
            {customer.phone}
            {customer.email && <span> · {customer.email}</span>}
          </p>
          <p className="mt-2 text-sm text-navy/80">{booking.message}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-xs text-navy/40">{booking.submittedAgo}</p>
          <div className="flex gap-1.5">
            <ContactIconLink href={telHref(customer.phone)} label={`Call ${customer.name}`}>
              <PhoneIcon className="h-4 w-4" />
            </ContactIconLink>
            <ContactIconLink href={waHref(customer.phone)} label={`WhatsApp ${customer.name}`} external>
              <WhatsAppIcon className="h-4 w-4" />
            </ContactIconLink>
            {customer.email && (
              <ContactIconLink href={mailtoHref(customer.email)} label={`Email ${customer.name}`}>
                <MailIcon className="h-4 w-4" />
              </ContactIconLink>
            )}
          </div>
        </div>
      </div>

      {(booking.status === "confirmed" || booking.status === "completed") && booking.calloutDate && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-navy">
          <CalendarIcon className="h-4 w-4 text-terracotta" />
          {booking.calloutDate} · {booking.timeWindow}
          {booking.status === "completed" && booking.amountChargedPence != null && (
            <span className="ml-2 rounded-full bg-grey px-2.5 py-0.5 text-xs font-semibold text-navy/60">
              Paid £{(booking.amountChargedPence / 100).toFixed(2)}
              {booking.paidVia ? ` · ${PAYMENT_METHOD_LABELS[booking.paidVia]}` : ""}
            </span>
          )}
        </p>
      )}

      {booking.status === "completed" && booking.needsNotes && (
        <JobNotesPrompt booking={booking} customer={customer} onSave={onSaveNotes} />
      )}

      {/* Action buttons per status */}
      {booking.status === "new" && !isOpen && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpen("reply")}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy hover:bg-grey"
          >
            <MailIcon className="h-4 w-4" />
            Reply & close
          </button>
          <button
            type="button"
            onClick={() => onOpen("confirm")}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
          >
            <ClockIcon className="h-4 w-4" />
            Confirm callout
          </button>
        </div>
      )}

      {booking.status === "confirmed" && !isOpen && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpen("reschedule")}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy hover:bg-grey"
          >
            <CalendarIcon className="h-4 w-4" />
            Reschedule
          </button>
          <button
            type="button"
            onClick={() => onOpen("complete")}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
          >
            <CheckIcon className="h-4 w-4" />
            Mark complete
          </button>
          <button
            type="button"
            onClick={onCancelJob}
            className="rounded-full px-3 py-2.5 text-sm font-semibold text-navy/40 hover:text-terracotta-dark"
          >
            Cancel job
          </button>
        </div>
      )}

      {isOpen === "reply" && <ReplyPanel onSend={onReply} onCancel={onClose} />}

      {isOpen === "confirm" && (
        <DateWindowPanel
          submitLabel="Confirm callout"
          conflictsFor={conflictsFor}
          onSubmit={onConfirm}
          onCancel={onClose}
          note="They'll need to pay £50 and save a card on file to confirm."
        />
      )}

      {isOpen === "reschedule" && (
        <DateWindowPanel
          submitLabel="Save new time"
          initialDate={booking.calloutDate}
          initialWindow={booking.timeWindow}
          conflictsFor={conflictsFor}
          onSubmit={onReschedule}
          onCancel={onClose}
          note="They'll get an email with the new date/time — no payment needed again."
        />
      )}

      {isOpen === "complete" && (
        <CompletePanel customer={customer} onSubmit={onComplete} onCancel={onClose} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: MockBooking["status"] }) {
  const labels: Record<MockBooking["status"], string> = {
    new: "New",
    answered: "Answered",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className="rounded-full bg-grey px-2.5 py-0.5 text-xs font-semibold text-navy/60">
      {labels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  highlight,
  onClick,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl p-4 text-left shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] transition-colors ${
        highlight && value > 0 ? "bg-terracotta-light hover:bg-terracotta-light/70" : "bg-white hover:bg-cream"
      }`}
    >
      <p
        className={`text-2xl font-extrabold ${
          highlight && value > 0 ? "text-terracotta-dark" : "text-navy"
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-0.5 text-xs font-semibold ${
          highlight && value > 0 ? "text-terracotta-dark/80" : "text-navy/50"
        }`}
      >
        {label}
      </p>
    </button>
  );
}

// A webhook payment with no matched customer — money in, no home. Fergal
// picks who it belongs to; their open job (if any) becomes the paid,
// completed one.
function UnmatchedPaymentCard({
  payment,
  customers,
  onAssign,
}: {
  payment: MockUnmatchedPayment;
  customers: MockCustomer[];
  onAssign: (customerId: string) => void | Promise<void>;
}) {
  const [customerId, setCustomerId] = useState("");
  const [assigning, setAssigning] = useState(false);

  return (
    <div className="mt-4 rounded-[24px] border-2 border-terracotta/40 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-base font-bold text-navy">
            <CreditCardIcon className="h-4 w-4 text-terracotta" />
            £{(payment.amountPence / 100).toFixed(2)} paid via {PAYMENT_METHOD_LABELS[payment.method]} —
            who was this?
          </p>
          <p className="mt-1 text-sm text-navy/60">
            Stripe couldn&apos;t say whose payment this is — pick the customer in the Stripe app
            before charging to avoid this. Assign it and it lands on their job and account.
          </p>
          <p className="mt-1.5 font-mono text-xs text-navy/40">{payment.stripePaymentIntentId}</p>
        </div>
        <p className="shrink-0 text-xs text-navy/40">{payment.receivedAgo}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy outline-none focus:border-terracotta"
        >
          <option value="">Choose a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.phone}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!customerId || assigning}
          onClick={async () => {
            setAssigning(true);
            await onAssign(customerId);
            setAssigning(false);
          }}
          className="bg-btn-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <CheckIcon className="h-4 w-4" />
          {assigning ? "Assigning…" : "Assign payment"}
        </button>
      </div>
    </div>
  );
}

function ContactIconLink({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-navy/60 transition-colors hover:bg-grey hover:text-navy"
    >
      {children}
    </a>
  );
}

// Shown on a completed job when a payment came in from the Stripe app
// (webhook sets needs_notes) but the visit hasn't been written up yet.
function JobNotesPrompt({
  booking,
  customer,
  onSave,
}: {
  booking: MockBooking;
  customer: MockCustomer;
  onSave: (notes: string) => void | Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const amount =
    booking.amountChargedPence != null ? `£${(booking.amountChargedPence / 100).toFixed(2)}` : "A payment";
  const via = booking.paidVia ? ` via ${PAYMENT_METHOD_LABELS[booking.paidVia]}` : "";

  return (
    <div className="mt-4 rounded-2xl bg-terracotta-light p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-terracotta-dark">
        <NoteIcon className="h-4 w-4" />
        {amount} came in{via} — write up the job
      </p>
      <p className="mt-1 text-xs text-terracotta-dark/80">
        For future engineers — and {customer.name.split(" ")[0]} sees these notes on their account
        too.
      </p>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What was done, parts used, anything worth flagging next time…"
        className="mt-3 w-full resize-none rounded-xl border border-terracotta/30 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
      />
      <button
        type="button"
        disabled={!notes.trim() || saving}
        onClick={async () => {
          setSaving(true);
          await onSave(notes);
          setSaving(false);
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <CheckIcon className="h-4 w-4" />
        {saving ? "Saving…" : "Save job notes"}
      </button>
    </div>
  );
}

function ReplyPanel({
  onSend,
  onCancel,
}: {
  onSend: (message: string) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <label className="mb-1.5 block text-xs font-semibold text-navy">Reply by email</label>
      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your reply…"
        className="w-full resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!message.trim() || sending}
          onClick={async () => {
            setSending(true);
            await onSend(message);
            setSending(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <MailIcon className="h-4 w-4" />
          {sending ? "Sending…" : "Send reply & close"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy/70 hover:bg-grey"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DateWindowPanel({
  submitLabel,
  initialDate,
  initialWindow,
  conflictsFor,
  onSubmit,
  onCancel,
  note,
}: {
  submitLabel: string;
  initialDate?: string;
  initialWindow?: string;
  conflictsFor: (date: string) => { name: string; timeWindow?: string }[];
  onSubmit: (date: string, timeWindow: string) => void;
  onCancel: () => void;
  note: string;
}) {
  const [date, setDate] = useState(initialDate ?? "");
  const [timeWindow, setTimeWindow] = useState(initialWindow ?? TIME_WINDOWS[0]);
  const [sending, setSending] = useState(false);

  const conflicts = date ? conflictsFor(date) : [];

  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-navy">Callout date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-navy">Time window</label>
          <select
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

      {conflicts.length > 0 && (
        <p className="mt-3 rounded-xl bg-terracotta-light px-3 py-2.5 text-xs text-terracotta-dark">
          Already booked that day: {conflicts.map((c) => `${c.name} (${c.timeWindow})`).join(", ")}
          — check the calendar before confirming another.
        </p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-navy/60">
        <CreditCardIcon className="h-3.5 w-3.5" />
        {note}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!date || sending}
          onClick={async () => {
            setSending(true);
            await onSubmit(date, timeWindow);
            setSending(false);
          }}
          className="bg-btn-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <CheckIcon className="h-4 w-4" />
          {sending ? "Sending…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy/70 hover:bg-grey"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CompletePanel({
  customer,
  onSubmit,
  onCancel,
}: {
  customer: MockCustomer;
  onSubmit: (notes: string, method: "card" | "invoice" | "tap", amountPence: number) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"card" | "invoice" | "tap">(
    customer.hasCardOnFile ? "card" : "invoice"
  );
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const amountPence = Math.round(parseFloat(amount || "0") * 100);
  const canCharge = method === "tap" || (amountPence > 0 && (method !== "card" || customer.hasCardOnFile));

  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <label className="mb-1.5 block text-xs font-semibold text-navy">
        Job notes (saved to {customer.name}&apos;s profile for future visits)
      </label>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What was done, parts used, anything worth flagging next time…"
        className="w-full resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
      />

      <p className="mt-4 text-xs font-semibold text-navy">How&apos;s this being paid?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <PaymentMethodButton
          active={method === "card"}
          onClick={() => setMethod("card")}
          disabled={!customer.hasCardOnFile}
          label="Card on file"
        />
        <PaymentMethodButton
          active={method === "invoice"}
          onClick={() => setMethod("invoice")}
          label="Email invoice"
        />
        <PaymentMethodButton active={method === "tap"} onClick={() => setMethod("tap")} label="Tap to pay" />
      </div>

      {method === "card" && !customer.hasCardOnFile && (
        <p className="mt-2 text-xs text-terracotta-dark">
          No card on file for {customer.name} — use email invoice instead, or take it via tap to
          pay.
        </p>
      )}

      {(method === "card" || method === "invoice") && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-navy">Amount (£)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-32 rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
          />
        </div>
      )}

      {method === "tap" && (
        <p className="mt-3 rounded-xl bg-grey px-3 py-2.5 text-xs text-navy/70">
          Open the Stripe app, find {customer.name}{" "}
          {customer.stripeCustomerId ? "in your customers" : "(they'll appear there once they've saved a card)"}, and charge them directly there — nothing else to do on this page.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!canCharge || sending}
          onClick={async () => {
            setSending(true);
            await onSubmit(notes, method, method === "tap" ? 0 : amountPence);
            setSending(false);
          }}
          className="bg-btn-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <CheckIcon className="h-4 w-4" />
          {sending
            ? "Saving…"
            : method === "card"
              ? "Charge card & mark complete"
              : method === "invoice"
                ? "Send invoice & mark complete"
                : "Mark complete"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy/70 hover:bg-grey"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PaymentMethodButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-navy text-white" : "border border-line text-navy/70 hover:bg-grey"
      }`}
    >
      {label}
    </button>
  );
}
