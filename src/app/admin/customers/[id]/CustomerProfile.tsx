"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BoilerIcon,
  CreditCardIcon,
  MapPinIcon,
  NoteIcon,
  PhoneIcon,
} from "@/components/icons";
import { getBookingsForCustomer, getCustomer, getNotesForCustomer, type MockNote } from "../../mockData";

// TODO(supabase): insert into `job_notes` (author_id = the admin's own
// profile id) once a project is connected — see
// supabase/migrations/20260828000000_init.sql.
async function addNoteStub(_args: { customerId: string; text: string }): Promise<{ error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { error: null };
}

export function CustomerProfile({ customerId }: { customerId: string }) {
  const customer = getCustomer(customerId);
  const [notes, setNotes] = useState<MockNote[]>(getNotesForCustomer(customerId));
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!customer) return null;
  const bookings = getBookingsForCustomer(customerId);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    await addNoteStub({ customerId, text: newNote });
    setSaving(false);

    setNotes((prev) => [
      { id: `note-${Date.now()}`, customerId, date: new Date().toISOString().slice(0, 10), text: newNote },
      ...prev,
    ]);
    setNewNote("");
  };

  return (
    <div>
      <Link href="/admin/customers" className="text-sm font-medium text-navy/50 hover:text-navy">
        ← All customers
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
        {customer.name}
      </h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/60">
        <PhoneIcon className="h-4 w-4" />
        {customer.phone}
        {customer.email && <span> · {customer.email}</span>}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)]">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy/40">
            <MapPinIcon className="h-3.5 w-3.5" />
            Address
          </p>
          <p className="mt-1.5 text-sm text-navy">{customer.address ?? "Not on file"}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)]">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy/40">
            <BoilerIcon className="h-3.5 w-3.5" />
            Boiler
          </p>
          <p className="mt-1.5 text-sm text-navy">
            {customer.boilerMake ? `${customer.boilerMake} · ${customer.boilerAge ?? "age unknown"}` : "Not on file"}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)] sm:col-span-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy/40">
            <CreditCardIcon className="h-3.5 w-3.5" />
            Payment
          </p>
          {customer.hasCardOnFile ? (
            <p className="mt-1.5 text-sm text-navy">
              Card on file — find them in the{" "}
              <span className="font-mono text-xs text-navy/60">{customer.stripeCustomerId}</span> Stripe
              customer for tap to pay.
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-navy/60">No card on file yet.</p>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold text-navy">Job history</h2>
      <div className="mt-3 flex flex-col gap-2">
        {bookings.length === 0 && <p className="text-sm text-navy/50">No jobs yet.</p>}
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl bg-white p-4 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)]">
            <p className="text-sm text-navy/80">{b.message}</p>
            <p className="mt-1.5 text-xs text-navy/50">
              {b.calloutDate ? `${b.calloutDate} · ${b.timeWindow}` : b.submittedAgo}
              {b.amountChargedPence != null && ` · Charged £${(b.amountChargedPence / 100).toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 flex items-center gap-1.5 text-lg font-bold text-navy">
        <NoteIcon className="h-4.5 w-4.5" />
        Notes
      </h2>
      <p className="mt-1 text-sm text-navy/60">Visible to Fergal only — for the next visit.</p>

      <div className="mt-3 rounded-2xl border border-line bg-white p-4">
        <textarea
          rows={2}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note…"
          className="w-full resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-terracotta"
        />
        <button
          type="button"
          disabled={!newNote.trim() || saving}
          onClick={handleAddNote}
          className="mt-2 rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {notes.map((note) => (
          <div key={note.id} className="rounded-2xl bg-white p-4 shadow-[0_15px_35px_-25px_rgba(31,42,58,0.3)]">
            <p className="text-xs font-semibold text-navy/50">{note.date}</p>
            <p className="mt-1 text-sm text-navy/80">{note.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
