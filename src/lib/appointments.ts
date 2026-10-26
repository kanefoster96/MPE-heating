import { createAdminClient } from "@/lib/supabase/admin";
import { formatPostcode, isValidPostcode } from "@/lib/validation";
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_STATUSES,
  PART_WINDOW,
  addDays,
  isISODate,
  parseHHMM,
  type AppointmentKind,
  type AppointmentStatus,
  type Part,
} from "@/lib/day-plan";
import type { NoticeType } from "@/lib/visit-copy";

/**
 * The schedule's visits (supabase/schema.sql `appointments`). Service-role
 * only: the team's pages check isCoach first; a customer only ever gets their
 * own, without the team's notes (lib/customers.ts, /account).
 */

export type Appointment = {
  id: string;
  customerId: string | null;
  enquiryId: string | null;
  kind: AppointmentKind;
  day: string;
  start: number;
  end: number;
  status: AppointmentStatus;
  title: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  engineerId: string | null;
  createdAt: string;
  /** What the customer asked for: morning, afternoon or any time. */
  part: Part | null;
  source: "team" | "website" | "account";
  publicToken: string;
  notifiedAt: string | null;
  notifiedVia: string[];
  lastNotice: NoticeType | null;
  remindedAt: string | null;
  /** The "on our way" message an hour before the window. */
  hourRemindedAt: string | null;
  /** After a "Not in": the message offering another time. */
  missedFollowupAt: string | null;
  serviceDueSentAt: string | null;
  staffNudgedAt: string | null;
  createdBy: string | null;
  /** What was done, in words the customer sees (lib/job-completion.ts). */
  jobReport: string | null;
  /** "On my way" sent: when, and roughly how many minutes away. */
  onMyWayAt: string | null;
  onMyWayEta: number | null;
  completedAt: string | null;
  reviewDueAt: string | null;
  reviewAskedAt: string | null;
  reviewRemindedAt: string | null;
  /** Finished fixed, or finished needing a return visit (a part to fit), with what for. */
  outcome: "fixed" | "return" | null;
  returnNote: string | null;
  /** A return visit: the visit it finishes the job for. */
  followUpOf: string | null;
  pastRequestSentAt: string | null;
  /** They said they won't be in: rebook them. */
  cantMakeAt: string | null;
  /** The customer asked to move it: to this day and part of the day. */
  change: { day: string; part: Part | null; note: string | null; at: string } | null;
};

type Row = {
  id: string;
  customer_id: string | null;
  enquiry_id: string | null;
  kind: AppointmentKind;
  day: string;
  start_minute: number;
  end_minute: number;
  status: AppointmentStatus;
  title: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  engineer_id: string | null;
  created_at: string;
  part: Part | null;
  source: Appointment["source"];
  public_token: string;
  notified_at: string | null;
  notified_via: string[] | null;
  last_notice: NoticeType | null;
  reminded_at: string | null;
  hour_reminded_at: string | null;
  missed_followup_at: string | null;
  service_due_sent_at: string | null;
  staff_nudged_at: string | null;
  created_by: string | null;
  job_report: string | null;
  on_my_way_at: string | null;
  on_my_way_eta: number | null;
  completed_at: string | null;
  review_due_at: string | null;
  review_asked_at: string | null;
  review_reminded_at: string | null;
  outcome: "fixed" | "return" | null;
  return_note: string | null;
  follow_up_of: string | null;
  past_request_sent_at: string | null;
  cant_make_at: string | null;
  change_day: string | null;
  change_part: Part | null;
  change_note: string | null;
  change_requested_at: string | null;
};

function mapAppointment(r: Row): Appointment {
  return {
    id: r.id,
    customerId: r.customer_id,
    enquiryId: r.enquiry_id,
    kind: r.kind,
    day: r.day,
    start: r.start_minute,
    end: r.end_minute,
    status: r.status,
    title: r.title,
    address: r.address,
    postcode: r.postcode,
    notes: r.notes,
    engineerId: r.engineer_id,
    createdAt: r.created_at,
    part: r.part ?? null,
    source: r.source ?? "team",
    publicToken: r.public_token,
    notifiedAt: r.notified_at ?? null,
    notifiedVia: r.notified_via ?? [],
    lastNotice: r.last_notice ?? null,
    remindedAt: r.reminded_at ?? null,
    hourRemindedAt: r.hour_reminded_at ?? null,
    missedFollowupAt: r.missed_followup_at ?? null,
    serviceDueSentAt: r.service_due_sent_at ?? null,
    staffNudgedAt: r.staff_nudged_at ?? null,
    createdBy: r.created_by ?? null,
    jobReport: r.job_report ?? null,
    onMyWayAt: r.on_my_way_at ?? null,
    onMyWayEta: r.on_my_way_eta ?? null,
    completedAt: r.completed_at ?? null,
    reviewDueAt: r.review_due_at ?? null,
    reviewAskedAt: r.review_asked_at ?? null,
    reviewRemindedAt: r.review_reminded_at ?? null,
    outcome: r.outcome ?? null,
    returnNote: r.return_note ?? null,
    followUpOf: r.follow_up_of ?? null,
    pastRequestSentAt: r.past_request_sent_at ?? null,
    cantMakeAt: r.cant_make_at ?? null,
    change:
      r.change_day && r.change_requested_at
        ? { day: r.change_day, part: r.change_part ?? null, note: r.change_note ?? null, at: r.change_requested_at }
        : null,
  };
}

/** Every visit between two dates, inclusive, in time order. */
export async function appointmentsBetween(fromISO: string, toISO: string): Promise<Appointment[]> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .gte("day", fromISO)
    .lte("day", toISO)
    .order("day")
    .order("start_minute")
    .limit(2000);
  return ((data ?? []) as Row[]).map(mapAppointment);
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("appointments").select("*").eq("id", id).maybeSingle();
  return data ? mapAppointment(data as Row) : null;
}

/** A customer's visits, latest first. */
/** The return visit booked to finish a job, if there is one (not cancelled). */
export async function returnVisitFor(id: string): Promise<Appointment | null> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("follow_up_of", id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapAppointment(data as Row) : null;
}

/** A visit finished as "coming back" that won't need one after all: it's simply done. */
export async function clearReturn(id: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("appointments").update({ outcome: null, updated_at: new Date().toISOString() }).eq("id", id).eq("outcome", "return").select("enquiry_id");
  // Nothing more to do on it: its booking's done too.
  const enquiryId = data?.[0]?.enquiry_id as string | null | undefined;
  if (enquiryId) await admin.from("enquiries").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", enquiryId).in("status", ["new", "contacted", "booked"]);
  return !error;
}

/**
 * What a new visit for this customer should really be: their open request
 * (book that, not a second visit), else a repair agreed at a call-out and
 * not booked yet (book it as the return visit, linked). Null for neither.
 */
export async function pendingForCustomer(customerId: string, today: string): Promise<{ request: Appointment | null; returnOf: Appointment | null }> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("customer_id", customerId)
    .eq("status", "requested")
    .gte("day", addDays(today, -7))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return { request: mapAppointment(data as Row), returnOf: null };
  const returnOf = (await returnsToBook()).find((v) => v.customerId === customerId) ?? null;
  return { request: null, returnOf };
}

/** "I won't be in", from the customer: reminders stop, and the team rebooks or cancels it. */
export async function markCantMake(id: string): Promise<boolean> {
  const { data } = await createAdminClient().from("appointments").update({ cant_make_at: new Date().toISOString() }).eq("id", id).eq("status", "booked").is("cant_make_at", null).select("id");
  return !!data?.length;
}

/** Running late: the arrival window moves on by this many minutes (same length), and no "an hour before" text after it. */
export async function shiftWindow(id: string, minutes: number): Promise<Appointment | null> {
  const v = await getAppointment(id);
  if (!v || v.status !== "booked") return null;
  const start = Math.min(v.start + minutes, 23 * 60);
  const end = Math.min(v.end + minutes, 23 * 60 + 59);
  const { error } = await createAdminClient()
    .from("appointments")
    .update({ start_minute: start, end_minute: end, hour_reminded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? null : { ...v, start, end };
}

/** The visits a job took, first to this one: a return visit points back to the one before. */
export async function visitChain(visit: Appointment): Promise<Appointment[]> {
  const chain = [visit];
  let parent = visit.followUpOf;
  while (parent && chain.length < 6) {
    const before = await getAppointment(parent);
    if (!before || chain.some((v) => v.id === before.id)) break;
    chain.unshift(before);
    parent = before.followUpOf;
  }
  return chain;
}

/** Visits finished as "coming back" with no return visit booked yet: the team's to book. */
export async function returnsToBook(): Promise<Appointment[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("appointments").select("*").eq("outcome", "return").eq("status", "done").order("completed_at", { ascending: false }).limit(300);
  const waiting = ((data ?? []) as Row[]).map(mapAppointment);
  if (!waiting.length) return [];
  const { data: booked } = await admin.from("appointments").select("follow_up_of").in("follow_up_of", waiting.map((v) => v.id)).neq("status", "cancelled");
  const have = new Set((booked ?? []).map((r) => r.follow_up_of as string));
  return waiting.filter((v) => !have.has(v.id));
}

export async function appointmentsForCustomer(customerId: string): Promise<Appointment[]> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("customer_id", customerId)
    .order("day", { ascending: false })
    .order("start_minute", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map(mapAppointment);
}

export type AppointmentInput = {
  customerId: string | null;
  enquiryId: string | null;
  kind: AppointmentKind;
  day: string;
  start: number;
  end: number;
  title: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  /** A return visit: the visit it finishes the job for. Left as it is when not given. */
  followUpOf?: string | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

/** Reads and checks the add/edit visit form. */
export function appointmentFromForm(formData: FormData): { ok: true; input: AppointmentInput } | { ok: false; error: string } {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const kind = get("kind") as AppointmentKind;
  if (!(APPOINTMENT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose what kind of visit it is." };
  const day = get("day");
  if (!isISODate(day)) return { ok: false, error: "Choose a day." };
  const start = parseHHMM(get("start"));
  const end = parseHHMM(get("end"));
  if (start === null || end === null) return { ok: false, error: "Set a time window." };
  if (end <= start) return { ok: false, error: "The window has to end after it starts." };
  const customerId = get("customerId");
  const enquiryId = get("enquiryId");
  const followUpOf = get("followUpOf");
  const title = get("title").slice(0, 120) || null;
  if (!customerId && !title) return { ok: false, error: "Pick a customer, or give it a title." };
  const postcodeRaw = get("postcode");
  if (postcodeRaw && !isValidPostcode(postcodeRaw)) return { ok: false, error: "Check the postcode." };
  return {
    ok: true,
    input: {
      customerId: UUID.test(customerId) ? customerId : null,
      enquiryId: UUID.test(enquiryId) ? enquiryId : null,
      kind,
      day,
      start,
      end,
      title,
      address: get("address").slice(0, 400) || null,
      postcode: postcodeRaw ? formatPostcode(postcodeRaw) : null,
      notes: get("notes").slice(0, 4000) || null,
      ...(UUID.test(followUpOf) ? { followUpOf } : {}),
    },
  };
}

function toColumns(input: AppointmentInput) {
  return {
    customer_id: input.customerId,
    enquiry_id: input.enquiryId,
    kind: input.kind,
    day: input.day,
    start_minute: input.start,
    end_minute: input.end,
    title: input.title,
    address: input.address,
    postcode: input.postcode,
    notes: input.notes,
    ...(input.followUpOf !== undefined ? { follow_up_of: input.followUpOf } : {}),
  };
}

export async function createAppointment(input: AppointmentInput, staffId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .insert({ ...toColumns(input), created_by: staffId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createAppointment failed", error);
    return null;
  }
  if (input.enquiryId) await markEnquiryBooked(input.enquiryId, staffId);
  if (input.customerId) await settleRequests(input, data.id as string, staffId);
  return data.id as string;
}

/** The booking forms a kind of visit answers (enquiries' categories): a call-out isn't a boiler quote. */
export function categoriesFor(kind: AppointmentKind): string[] {
  if (kind === "callout" || kind === "repair") return ["callout", "other"];
  if (kind === "service") return ["service", "plan"];
  if (kind === "quote" || kind === "install") return ["new_boiler", "commercial"];
  return ["other", "commercial"];
}

/** Call-outs and repair visits are one kind of job: booking either answers a request for the other. */
const FAMILY: Partial<Record<AppointmentKind, AppointmentKind[]>> = { callout: ["callout", "repair"], repair: ["callout", "repair"] };

/**
 * A visit added for a customer answers what they'd asked for: their open
 * request for this job (the same booking, or the same kind of visit) is
 * done with, quietly, so it never reads as "we didn't get to you", and
 * their bookings waiting in the chat are booked.
 */
async function settleRequests(input: AppointmentInput, newId: string, staffId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: open } = await admin.from("appointments").select("id, kind, enquiry_id").eq("customer_id", input.customerId!).eq("status", "requested").neq("id", newId);
  const kinds = FAMILY[input.kind] ?? [input.kind];
  const answered = ((open ?? []) as { id: string; kind: AppointmentKind; enquiry_id: string | null }[]).filter(
    (r) => (input.enquiryId && r.enquiry_id === input.enquiryId) || kinds.includes(r.kind),
  );
  if (answered.length) {
    await admin.from("appointments").update({ status: "cancelled", updated_at: new Date().toISOString() }).in("id", answered.map((r) => r.id)).eq("status", "requested");
    for (const r of answered) if (r.enquiry_id) await markEnquiryBooked(r.enquiry_id, staffId);
  }
  const { data: customer } = await admin.from("customers").select("conversation_id").eq("id", input.customerId!).maybeSingle();
  if (customer?.conversation_id) {
    await admin
      .from("enquiries")
      .update({ status: "booked", updated_at: new Date().toISOString(), updated_by: staffId })
      .eq("conversation_id", customer.conversation_id as string)
      .in("category", categoriesFor(input.kind))
      .in("status", ["new", "contacted"]);
  }
}

/** Booking a visit moves its booking form along, from new or contacted to booked. */
export async function markEnquiryBooked(enquiryId: string, staffId: string): Promise<void> {
  await createAdminClient()
    .from("enquiries")
    .update({ status: "booked", updated_at: new Date().toISOString(), updated_by: staffId })
    .eq("id", enquiryId)
    .in("status", ["new", "contacted"]);
}

export async function updateAppointment(
  id: string,
  input: AppointmentInput,
  opts: { status?: AppointmentStatus; clearChange?: boolean } = {},
): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("appointments")
    .update({
      ...toColumns(input),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.clearChange ? { change_day: null, change_part: null, change_note: null, change_requested_at: null, cant_make_at: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

/** Accepts a customer's request as it is: booked, in the window they asked for. */
export async function acceptRequest(id: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("appointments")
    .update({ status: "booked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "requested");
  return !error;
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<boolean> {
  if (!(APPOINTMENT_STATUSES as readonly string[]).includes(status)) return false;
  // Accepting or moving a visit answers any request to move it.
  if (status !== "booked") await clearChangeRequest(id);
  const { error } = await createAdminClient()
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const { error } = await createAdminClient().from("appointments").delete().eq("id", id);
  return !error;
}

/** A visit by its private link, for the customer's /visit page. */
export async function getAppointmentByToken(token: string): Promise<Appointment | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("appointments").select("*").eq("public_token", token).maybeSingle();
  return data ? mapAppointment(data as Row) : null;
}

/**
 * A customer asking for a visit (a booking form or their account): saved as
 * 'requested' in the window for the part of the day they picked, so it sits
 * on the team's schedule where it would go, waiting to be accepted or moved.
 */
export async function createRequest(input: {
  customerId: string;
  enquiryId?: string | null;
  kind: AppointmentKind;
  day: string;
  part: Part;
  note?: string | null;
  /** Notes for the team as they are (the booking form's answers). */
  notes?: string | null;
  address?: string | null;
  postcode?: string | null;
  source: "website" | "account";
}): Promise<Appointment | null> {
  const window = PART_WINDOW[input.part];
  const { data, error } = await createAdminClient()
    .from("appointments")
    .insert({
      customer_id: input.customerId,
      enquiry_id: input.enquiryId ?? null,
      kind: input.kind,
      day: input.day,
      start_minute: window.start,
      end_minute: window.end,
      part: input.part,
      status: "requested",
      source: input.source,
      address: input.address ?? null,
      postcode: input.postcode ?? null,
      notes: input.notes ? input.notes.slice(0, 4000) : input.note ? `From the customer: ${input.note.slice(0, 2000)}` : null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("createRequest failed", error);
    return null;
  }
  return mapAppointment(data as Row);
}

/** Notes what the customer was told, and how. */
export async function recordNotice(id: string, type: NoticeType, via: string[]): Promise<void> {
  const now = new Date().toISOString();
  await createAdminClient()
    .from("appointments")
    .update(
      type === "reminder"
        ? { reminded_at: now }
        : type === "hour"
          ? { hour_reminded_at: now }
          : type === "missed"
            ? { missed_followup_at: now }
          : type === "past_request"
            ? { past_request_sent_at: now }
            : type === "service_due"
              ? { service_due_sent_at: now }
              : { notified_at: now, notified_via: via, last_notice: type },
    )
    .eq("id", id);
}

/** The customer asked to move their visit. */
export async function setChangeRequest(id: string, change: { day: string; part: Part; note: string | null }): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("appointments")
    .update({
      change_day: change.day,
      change_part: change.part,
      change_note: change.note,
      change_requested_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

export async function clearChangeRequest(id: string): Promise<void> {
  await createAdminClient()
    .from("appointments")
    .update({ change_day: null, change_part: null, change_note: null, change_requested_at: null })
    .eq("id", id);
}

/**
 * New requests from today on, and booked or missed visits whose customer
 * asked for another time from today on (a missed visit's own day is past).
 */
// A request whose day went by unbooked still waits, for a week: the customer's asked to pick another day.
function waitingFilter(fromISO: string): string {
  return `and(status.eq.requested,day.gte.${addDays(fromISO, -7)}),and(status.in.(booked,no_access),change_requested_at.not.is.null,change_day.gte.${fromISO})`;
}

/** Visits waiting on the team from today on: new requests, and customers asking to move. */
export async function waitingOnTeam(fromISO: string): Promise<Appointment[]> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .or(waitingFilter(fromISO))
    .order("day")
    .order("start_minute")
    .limit(100);
  return ((data ?? []) as Row[]).map(mapAppointment);
}

/** How many are waiting, for the Schedule tab's badge. */
export async function waitingOnTeamCount(fromISO: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .or(waitingFilter(fromISO));
  return count ?? 0;
}

/** Booked visits on a day whose customer hasn't had a reminder yet. */
export async function remindersDue(dayISO: string): Promise<Appointment[]> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("day", dayISO)
    .eq("status", "booked")
    .not("customer_id", "is", null)
    .is("reminded_at", null)
    // They've said they won't be in: no reminder for it.
    .is("cant_make_at", null);
  return ((data ?? []) as Row[]).map(mapAppointment);
}
