import {
  acceptRequest,
  categoriesFor,
  clearReturn,
  pendingForCustomer,
  appointmentFromForm,
  appointmentsBetween,
  clearChangeRequest,
  createAppointment,
  deleteAppointment,
  getAppointment,
  markEnquiryBooked,
  setAppointmentStatus,
  updateAppointment,
} from "@/lib/appointments";
import { createCustomer, customerFieldsFromForm, customerLabel, getCustomer, listCustomers } from "@/lib/customers";
import { closedDays } from "@/lib/days-off";
import { APPOINTMENT_KINDS, KIND_DEFAULT_MINUTES, KIND_LABEL, PART_LABEL, PART_WINDOW, addDays, longDate, toHHMM, type AppointmentKind } from "@/lib/day-plan";
import { enquiriesForConversation, enquiryNotes, visitKindFor } from "@/lib/enquiries";
import { londonNow } from "@/lib/schedule-time";
import { sendVisitNotice, viaPhrase } from "@/lib/visit-notify";
import type { NoticeType } from "@/lib/visit-copy";

/**
 * The team's calendar in the app (mobile/app/calendar.tsx and
 * visit-form.tsx): the website's schedule, without the website. Adding,
 * moving and cancelling visits, and answering requests, go through the
 * same checks and messages as /staff/schedule (src/app/staff/schedule/
 * actions.ts): the form's fields are read by appointmentFromForm, a new
 * customer by customerFieldsFromForm, and the customer's told by
 * sendVisitNotice.
 */

export type MonthDay = { day: string; count: number; requested: number; kinds: AppointmentKind[]; closed: boolean };

/** A month at a glance: how many visits each day, and the days off. */
export async function monthSummary(month: string): Promise<{ month: string; label: string; today: string; days: MonthDay[] }> {
  const today = londonNow().dateISO;
  const m = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const first = `${m}-01`;
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1);
  const [visits, closed] = await Promise.all([appointmentsBetween(first, last), closedDays(first, last).catch(() => new Map<string, string | null>())]);
  const days: MonthDay[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const on = visits.filter((v) => v.day === d && v.status !== "cancelled");
    days.push({ day: d, count: on.filter((v) => v.status !== "requested").length, requested: on.filter((v) => v.status === "requested").length, kinds: [...new Set(on.map((v) => v.kind))].slice(0, 3), closed: closed.has(d) });
  }
  return { month: m, label: new Date(`${first}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), today, days };
}

export type VisitDraft = {
  id: string | null;
  status: string | null;
  kind: AppointmentKind;
  day: string;
  start: string;
  end: string;
  title: string;
  address: string;
  postcode: string;
  notes: string;
  customer: { id: string; label: string } | null;
  enquiryId: string | null;
  /** A return visit: the visit it finishes the job for. */
  followUpOf: string | null;
  /** The customer asked to move it: to this day and part of the day. */
  change: { day: string; label: string; start: string; end: string; note: string | null } | null;
  /** A request: what they asked for. */
  asked: string | null;
};

export const KINDS = APPOINTMENT_KINDS.map((k) => ({ key: k, label: KIND_LABEL[k], minutes: KIND_DEFAULT_MINUTES[k] }));

/** Where a new visit's time starts: 9am, or on a day that's begun, the next hour (so not a time that's gone). */
function firstSlot(day: string, kind: AppointmentKind): { start: string; end: string } {
  const now = londonNow();
  const start = day === now.dateISO ? Math.min(Math.max(9 * 60, Math.ceil((now.minutes + 30) / 60) * 60), 18 * 60) : 9 * 60;
  return { start: toHHMM(start), end: toHHMM(Math.min(start + KIND_DEFAULT_MINUTES[kind], 23 * 60 + 59)) };
}

/** A visit as the form edits it, or a new one (for a customer, on a day). */
export async function visitDraft(params: { id?: string | null; customerId?: string | null; day?: string | null; followUp?: string | null; conversationId?: string | null }): Promise<VisitDraft | null> {
  if (params.id) {
    const v = await getAppointment(params.id);
    if (!v) return null;
    const c = v.customerId ? await getCustomer(v.customerId) : null;
    // A request whose day has gone: the form starts from today.
    const now = londonNow();
    const gone = v.status === "requested" && (v.day < now.dateISO || (v.day === now.dateISO && v.start < now.minutes));
    const day = gone ? now.dateISO : v.day;
    const slot = gone ? firstSlot(day, v.kind) : { start: toHHMM(v.start), end: toHHMM(v.end) };
    return {
      id: v.id,
      status: v.status,
      kind: v.kind,
      day,
      start: slot.start,
      end: slot.end,
      title: v.title ?? "",
      address: v.address ?? "",
      postcode: v.postcode ?? "",
      notes: v.notes ?? "",
      customer: c ? { id: c.id, label: customerLabel(c) } : null,
      enquiryId: v.enquiryId,
      followUpOf: v.followUpOf,
      change: v.change
        ? {
            day: v.change.day,
            label: `${longDate(v.change.day)}, ${PART_LABEL[v.change.part ?? "any"].toLowerCase()}`,
            start: toHHMM(PART_WINDOW[v.change.part ?? "any"].start),
            end: toHHMM(PART_WINDOW[v.change.part ?? "any"].end),
            note: v.change.note,
          }
        : null,
      asked: v.status === "requested" ? `${longDate(v.day)}, ${PART_LABEL[v.part ?? "any"].toLowerCase()}` : null,
    };
  }
  const today = londonNow().dateISO;
  const pickedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  // The return visit for a job finished as "coming back": a repair for the same customer and place.
  const first = params.followUp && /^[0-9a-f-]{36}$/i.test(params.followUp) ? await getAppointment(params.followUp) : null;
  if (first) {
    const fc = first.customerId ? await getCustomer(first.customerId) : null;
    const what = first.returnNote ?? "";
    return {
      id: null,
      status: null,
      kind: "repair",
      day: pickedDay,
      ...firstSlot(pickedDay, "repair"),
      title: what ? what.charAt(0).toUpperCase() + what.slice(1) : "",
      address: first.address ?? fc?.address ?? "",
      postcode: first.postcode ?? fc?.postcode ?? "",
      notes: `Return visit to finish the ${KIND_LABEL[first.kind].toLowerCase()} on ${longDate(first.day)}.${first.jobReport ? `\nFound: ${first.jobReport}` : ""}`,
      customer: fc ? { id: fc.id, label: customerLabel(fc) } : null,
      enquiryId: first.enquiryId,
      followUpOf: first.id,
      change: null,
      asked: null,
    };
  }
  const c = params.customerId ? await getCustomer(params.customerId) : null;
  // They've asked for a visit already (the booking form's "when suits you"): book that, not a second one.
  // Or a repair agreed at their call-out and not booked yet: that's the return visit, linked.
  if (c) {
    const pending = await pendingForCustomer(c.id, today);
    if (pending.request) return visitDraft({ id: pending.request.id });
    if (pending.returnOf) return visitDraft({ followUp: pending.returnOf.id, day: params.day });
  }
  // Else their latest booking still waiting in the chat: its kind, and the fault in their words.
  const conversationId = params.conversationId ?? c?.conversationId ?? null;
  const enquiry = conversationId ? (await enquiriesForConversation(conversationId).catch(() => [])).find((e) => e.status === "new" || e.status === "contacted") : undefined;
  const kind: AppointmentKind = enquiry ? visitKindFor(enquiry.category) : "callout";
  return {
    id: null,
    status: null,
    kind,
    day: pickedDay,
    ...firstSlot(pickedDay, kind),
    title: "",
    address: c?.address ?? "",
    postcode: c?.postcode ?? enquiry?.postcode ?? "",
    notes: enquiry ? enquiryNotes(enquiry) : "",
    customer: c ? { id: c.id, label: customerLabel(c) } : null,
    enquiryId: enquiry?.id ?? null,
    followUpOf: null,
    change: null,
    asked: null,
  };
}

/** The customer picker: name, email, phone or postcode. */
export async function customerOptions(q: string) {
  const found = await listCustomers(q, 12);
  return found.map((c) => ({
    id: c.id,
    label: customerLabel(c),
    sub: [c.postcode, c.phone, c.name ? c.email : null].filter(Boolean).join(" · "),
    address: c.address ?? "",
    postcode: c.postcode ?? "",
  }));
}

export type VisitBody = {
  kind?: string;
  day?: string;
  start?: string;
  end?: string;
  title?: string;
  address?: string;
  postcode?: string;
  notes?: string;
  customerId?: string | null;
  enquiryId?: string | null;
  /** A return visit: the visit it finishes the job for. */
  followUpOf?: string | null;
  /** From a chat: its open booking forms are marked booked. */
  conversationId?: string | null;
  newCustomer?: { name?: string; phone?: string; email?: string } | null;
  notify?: boolean;
};

function asForm(body: VisitBody): FormData {
  const form = new FormData();
  for (const key of ["kind", "day", "start", "end", "title", "address", "postcode", "notes", "customerId", "enquiryId", "followUpOf"] as const) {
    const value = body[key];
    if (typeof value === "string") form.set(key, value);
  }
  return form;
}

function sentLine(sent: string[] | null, name: string | null): string {
  if (sent === null) return "";
  return sent.length ? ` ${name ? `${name.split(" ")[0]} was` : "They were"} told by ${viaPhrase(sent)}.` : " We couldn't reach them: add a mobile or email to their details.";
}

/** Adds or saves a visit, as the schedule's form does. */
export async function saveVisit(
  id: string | null,
  body: VisitBody,
  staffId: string,
): Promise<{ ok: true; id: string; day: string; message: string } | { ok: false; error: string }> {
  const form = asForm(body);
  // A new customer typed in: made first.
  const fresh = body.newCustomer;
  if (!body.customerId && fresh && (fresh.name || fresh.phone || fresh.email)) {
    const fields = new FormData();
    fields.set("name", fresh.name ?? "");
    fields.set("phone", fresh.phone ?? "");
    fields.set("email", fresh.email ?? "");
    fields.set("address", body.address ?? "");
    fields.set("postcode", body.postcode ?? "");
    const parsed = customerFieldsFromForm(fields);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const created = await createCustomer(parsed.fields);
    if (!created.ok) return { ok: false, error: created.error };
    form.set("customerId", created.id);
  }
  const parsed = appointmentFromForm(form);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const input = parsed.input;
  const customer = input.customerId ? await getCustomer(input.customerId) : null;

  if (!id) {
    if (input.day < londonNow().dateISO) return { ok: false, error: "That day's gone. Pick today or later." };
    const created = await createAppointment(input, staffId);
    if (!created) return { ok: false, error: "Couldn't add that visit." };
    // Their bookings waiting in the chat are booked now, from wherever the visit was added.
    const conversationId = body.conversationId ?? customer?.conversationId ?? null;
    if (!input.enquiryId && conversationId) {
      for (const e of await enquiriesForConversation(conversationId).catch(() => [])) {
        if ((e.status === "new" || e.status === "contacted") && categoriesFor(input.kind).includes(e.category)) await markEnquiryBooked(e.id, staffId);
      }
    }
    const sent = body.notify && input.customerId ? await sendVisitNotice(created, "booked", staffId) : null;
    return { ok: true, id: created, day: input.day, message: `Booked for ${longDate(input.day)}.${sentLine(sent, customer?.name ?? null)}` };
  }

  const before = await getAppointment(id);
  if (!before) return { ok: false, error: "That visit's gone." };
  const timeChanged = input.day !== before.day || input.start !== before.start || input.end !== before.end;
  // A request, or a missed visit given a new time, is booked on save.
  const wasRequest = before.status === "requested" || (before.status === "no_access" && timeChanged);
  // Booking (or moving) onto a day that's gone would tell the customer a date that's passed.
  if ((wasRequest || timeChanged) && input.day < londonNow().dateISO) return { ok: false, error: "That day's gone. Pick today or later." };
  const ok = await updateAppointment(id, input, { status: wasRequest ? "booked" : undefined, clearChange: wasRequest || timeChanged });
  if (!ok) return { ok: false, error: "Couldn't save that visit." };
  if (wasRequest && before.enquiryId) await markEnquiryBooked(before.enquiryId, staffId);
  const notice: NoticeType | null = wasRequest || before.customerId !== input.customerId ? "booked" : timeChanged && before.status === "booked" ? "moved" : null;
  const sent = notice && body.notify && input.customerId ? await sendVisitNotice(id, notice, staffId) : null;
  return { ok: true, id, day: input.day, message: `${wasRequest ? "Booked" : timeChanged ? "Moved" : "Saved"}.${sentLine(sent, customer?.name ?? null)}` };
}

export const VISIT_ACTIONS = ["accept", "keep", "send", "booked", "cancel", "cancel_quietly", "remove", "no_return"] as const;
export type VisitAction = (typeof VISIT_ACTIONS)[number];

/** The buttons on a visit: accept a request as asked, keep the time they asked to move, send the details again, back to booked, cancel (telling them or not), remove. */
export async function visitAction(id: string, action: VisitAction, staffId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const visit = await getAppointment(id);
  if (!visit) return { ok: false, error: "That visit's gone." };
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const name = customer?.name ?? null;
  switch (action) {
    case "accept": {
      if (visit.status !== "requested") return { ok: false, error: "That's already been answered." };
      if (visit.day < londonNow().dateISO) return { ok: false, error: "That day's gone. Pick a new time with Move or change." };
      await acceptRequest(id);
      if (visit.enquiryId) await markEnquiryBooked(visit.enquiryId, staffId);
      const sent = visit.customerId ? await sendVisitNotice(id, "booked", staffId) : null;
      return { ok: true, message: `Booked as they asked.${sentLine(sent, name)}` };
    }
    case "keep":
      await clearChangeRequest(id);
      return { ok: true, message: "Kept at the same time." };
    case "send": {
      if (!visit.customerId) return { ok: false, error: "There's no customer on this visit." };
      const type: NoticeType = visit.status === "cancelled" ? "cancelled" : visit.status === "no_access" ? "missed" : visit.lastNotice === "moved" ? "moved" : "booked";
      const sent = await sendVisitNotice(id, type, staffId);
      return { ok: true, message: sent.length ? `Sent to ${name ?? "them"} by ${viaPhrase(sent)}.` : "We couldn't reach them: add a mobile or email to their details." };
    }
    case "booked":
      await setAppointmentStatus(id, "booked");
      return { ok: true, message: "Back to booked." };
    case "cancel":
    case "cancel_quietly": {
      await setAppointmentStatus(id, "cancelled");
      const sent = action === "cancel" && visit.customerId && visit.status !== "requested" ? await sendVisitNotice(id, "cancelled", staffId) : null;
      return { ok: true, message: `Cancelled.${sentLine(sent, name)}` };
    }
    case "remove":
      if (!(await deleteAppointment(id))) return { ok: false, error: "Couldn't remove that visit." };
      return { ok: true, message: "Removed." };
    case "no_return":
      // Coming back, then not needed after all (they've gone elsewhere, say): off the to-book list.
      if (!(await clearReturn(id))) return { ok: false, error: "Couldn't save that." };
      return { ok: true, message: "Done: no return visit to book." };
  }
}
