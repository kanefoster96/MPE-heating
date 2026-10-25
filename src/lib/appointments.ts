import { createAdminClient } from "@/lib/supabase/admin";
import { formatPostcode, isValidPostcode } from "@/lib/validation";
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_STATUSES,
  isISODate,
  parseHHMM,
  type AppointmentKind,
  type AppointmentStatus,
} from "@/lib/day-plan";

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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .insert({ ...toColumns(input), created_by: staffId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createAppointment failed", error);
    return null;
  }
  // Booking it moves the booking form along.
  if (input.enquiryId) {
    await admin
      .from("enquiries")
      .update({ status: "booked", updated_at: new Date().toISOString(), updated_by: staffId })
      .eq("id", input.enquiryId)
      .in("status", ["new", "contacted"]);
  }
  return data.id as string;
}

export async function updateAppointment(id: string, input: AppointmentInput): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("appointments")
    .update({ ...toColumns(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<boolean> {
  if (!(APPOINTMENT_STATUSES as readonly string[]).includes(status)) return false;
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
