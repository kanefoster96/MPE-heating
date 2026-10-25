import { createAdminClient } from "@/lib/supabase/admin";
import { formatPostcode, isValidPostcode } from "@/lib/validation";
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_STATUSES,
  PART_WINDOW,
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
  return data.id as string;
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
      ...(opts.clearChange ? { change_day: null, change_part: null, change_note: null, change_requested_at: null } : {}),
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
      notes: input.note ? `From the customer: ${input.note.slice(0, 2000)}` : null,
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
    .update(type === "reminder" ? { reminded_at: now } : { notified_at: now, notified_via: via, last_notice: type })
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

/** Visits waiting on the team from today on: new requests, and customers asking to move. */
export async function waitingOnTeam(fromISO: string): Promise<Appointment[]> {
  const { data } = await createAdminClient()
    .from("appointments")
    .select("*")
    .gte("day", fromISO)
    .or("status.eq.requested,and(status.eq.booked,change_requested_at.not.is.null)")
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
    .gte("day", fromISO)
    .or("status.eq.requested,and(status.eq.booked,change_requested_at.not.is.null)");
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
    .is("reminded_at", null);
  return ((data ?? []) as Row[]).map(mapAppointment);
}
