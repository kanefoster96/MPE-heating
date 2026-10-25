import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { formatPostcode, isValidEmail, isValidPostcode } from "@/lib/validation";

/**
 * Customers: one record per household, with their address and boiler, the
 * team's private notes, their visits and their bookings. MPE's addition to
 * Kanvas Academy's contact pages (coach/students/contacts), which kept a
 * phone and address on each account: a boiler business needs the boiler too,
 * and plenty of customers never make an account, so the record stands on its
 * own and links to a login only when the customer signs in at /account.
 *
 * Service-role only (supabase/schema.sql). Every caller checks who's asking
 * first: the team (lib/coach.ts) or the customer themselves (by user_id).
 */

export type Customer = {
  id: string;
  userId: string | null;
  conversationId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  address: string | null;
  postcode: string | null;
  boilerMake: string | null;
  boilerModel: string | null;
  boilerAge: string | null;
  boilerLocation: string | null;
  lastService: string | null;
  boilerNotes: string | null;
  accessNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerNote = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  address: string | null;
  postcode: string | null;
  boiler_make: string | null;
  boiler_model: string | null;
  boiler_age: string | null;
  boiler_location: string | null;
  last_service: string | null;
  boiler_notes: string | null;
  access_notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapCustomer(r: Row): Customer {
  return {
    id: r.id,
    userId: r.user_id,
    conversationId: r.conversation_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    phoneE164: r.phone_e164,
    address: r.address,
    postcode: r.postcode,
    boilerMake: r.boiler_make,
    boilerModel: r.boiler_model,
    boilerAge: r.boiler_age,
    boilerLocation: r.boiler_location,
    lastService: r.last_service,
    boilerNotes: r.boiler_notes ?? null,
    accessNotes: r.access_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The name to show: their name, else their email or number. */
export function customerLabel(c: Pick<Customer, "name" | "email" | "phone">): string {
  return c.name || c.email || c.phone || "Customer";
}

/** Whether customer records can be kept: the Supabase service key is set. */
export function customersOn(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// Editing: the fields, who may change which, and checking what was typed.

/** Everything on a customer that a form can change. */
export type CustomerFields = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  boilerMake: string | null;
  boilerModel: string | null;
  boilerAge: string | null;
  boilerLocation: string | null;
  lastService: string | null;
  boilerNotes: string | null;
  accessNotes: string | null;
};

const FIELD_COLUMN: Record<keyof CustomerFields, keyof Row> = {
  name: "name",
  email: "email",
  phone: "phone",
  address: "address",
  postcode: "postcode",
  boilerMake: "boiler_make",
  boilerModel: "boiler_model",
  boilerAge: "boiler_age",
  boilerLocation: "boiler_location",
  lastService: "last_service",
  boilerNotes: "boiler_notes",
  accessNotes: "access_notes",
};

const MAX_LENGTH: Partial<Record<keyof CustomerFields, number>> = { address: 400, accessNotes: 1000, boilerNotes: 1000, name: 120, email: 200 };

/**
 * Reads and checks a customer form. Empty fields clear; a phone must be a
 * real UK number, an email an email, a postcode a postcode. The customer's
 * own form leaves out their email (it's their login), so only the fields
 * present on the form are returned.
 */
export function customerFieldsFromForm(
  formData: FormData,
): { ok: true; fields: Partial<CustomerFields> } | { ok: false; error: string } {
  const fields: Partial<CustomerFields> = {};
  for (const key of Object.keys(FIELD_COLUMN) as (keyof CustomerFields)[]) {
    if (!formData.has(key)) continue;
    const value = String(formData.get(key) ?? "").trim().slice(0, MAX_LENGTH[key] ?? 120);
    fields[key] = value || null;
  }
  if (fields.email) {
    fields.email = fields.email.toLowerCase();
    if (!isValidEmail(fields.email)) return { ok: false, error: "Check the email address." };
  }
  if (fields.phone && !normalizePhone(fields.phone)) return { ok: false, error: "Enter a valid UK phone number, e.g. 07123 456789." };
  if (fields.postcode) {
    if (!isValidPostcode(fields.postcode)) return { ok: false, error: "Check the postcode." };
    fields.postcode = formatPostcode(fields.postcode);
  }
  return { ok: true, fields };
}

function toColumns(fields: Partial<CustomerFields>): Record<string, string | null> {
  const columns: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields) as [keyof CustomerFields, string | null][]) {
    columns[FIELD_COLUMN[key]] = value;
  }
  if ("phone" in fields) columns.phone_e164 = fields.phone ? normalizePhone(fields.phone) : null;
  return columns;
}

const DUPLICATE_ERROR: Record<string, string> = {
  customers_email_idx: "Another customer already has that email.",
  customers_phone_idx: "Another customer already has that phone number.",
};

/** Saves changes to a customer. The team can change every field. */
export async function updateCustomer(
  id: string,
  fields: Partial<CustomerFields>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createAdminClient()
    .from("customers")
    .update({ ...toColumns(fields), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    const dup = error.code === "23505" ? Object.entries(DUPLICATE_ERROR).find(([index]) => error.message.includes(index)) : null;
    return { ok: false, error: dup ? dup[1] : "Couldn't save those details." };
  }
  return { ok: true };
}

/** Adds a customer by hand, from the team's customer list or the schedule. */
export async function createCustomer(fields: Partial<CustomerFields>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!fields.name && !fields.email && !fields.phone) return { ok: false, error: "Add a name, email or phone number." };
  const { data, error } = await createAdminClient().from("customers").insert(toColumns(fields)).select("id").single();
  if (error || !data) {
    const dup = error?.code === "23505" ? Object.entries(DUPLICATE_ERROR).find(([index]) => error.message.includes(index)) : null;
    return { ok: false, error: dup ? dup[1] : "Couldn't add that customer." };
  }
  return { ok: true, id: data.id as string };
}

// ---------------------------------------------------------------------------
// Finding customers.

export async function getCustomer(id: string): Promise<Customer | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("customers").select("*").eq("id", id).maybeSingle();
  return data ? mapCustomer(data as Row) : null;
}

export async function getCustomers(ids: string[]): Promise<Map<string, Customer>> {
  if (ids.length === 0) return new Map();
  const { data } = await createAdminClient().from("customers").select("*").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as Row[]).map((r) => [r.id, mapCustomer(r)]));
}

export async function customerForConversation(conversationId: string): Promise<Customer | null> {
  const { data } = await createAdminClient().from("customers").select("*").eq("conversation_id", conversationId).limit(1).maybeSingle();
  return data ? mapCustomer(data as Row) : null;
}

/** Strips characters that would break a PostgREST `or` filter. */
function searchTerm(q: string): string {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
}

/** The customer list, newest first, or those matching a search. */
export async function listCustomers(q?: string, limit = 100): Promise<Customer[]> {
  let query = createAdminClient().from("customers").select("*").order("updated_at", { ascending: false }).limit(limit);
  const term = q ? searchTerm(q) : "";
  if (term) {
    const like = `%${term}%`;
    const digits = term.replace(/\D/g, "");
    const filters = [`name.ilike.${like}`, `email.ilike.${like}`, `postcode.ilike.${like}`, `address.ilike.${like}`, `phone.ilike.${like}`];
    if (digits.length >= 4) filters.push(`phone_e164.ilike.%${digits.replace(/^0/, "")}%`);
    query = query.or(filters.join(","));
  }
  const { data } = await query;
  return ((data ?? []) as Row[]).map(mapCustomer);
}

/**
 * The customer for some contact details: theirs if we know the email or
 * number, else a new record. Fills in what was missing, never overwrites
 * what's there (the team or the customer may have corrected it). Used by the
 * booking forms and the chat, so every enquiry has a customer.
 */
export async function findOrCreateCustomer(
  admin: SupabaseClient,
  input: { name?: string | null; email?: string | null; phone?: string | null; postcode?: string | null; conversationId?: string | null },
): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const e164 = input.phone ? normalizePhone(input.phone) : null;
  if (!email && !e164) return null;

  let existing: Row | null = null;
  if (email) {
    const { data } = await admin.from("customers").select("*").eq("email", email).maybeSingle();
    existing = (data as Row | null) ?? null;
  }
  if (!existing && e164) {
    const { data } = await admin.from("customers").select("*").eq("phone_e164", e164).maybeSingle();
    existing = (data as Row | null) ?? null;
  }

  if (existing) {
    const fill: Record<string, string> = {};
    if (!existing.name && input.name) fill.name = input.name;
    if (!existing.email && email) fill.email = email;
    if (!existing.phone_e164 && e164 && input.phone) {
      fill.phone = input.phone;
      fill.phone_e164 = e164;
    }
    if (!existing.postcode && input.postcode) fill.postcode = input.postcode;
    if (!existing.conversation_id && input.conversationId) fill.conversation_id = input.conversationId;
    if (Object.keys(fill).length) {
      const { error } = await admin.from("customers").update({ ...fill, updated_at: new Date().toISOString() }).eq("id", existing.id);
      // Another record already holds that email or number: leave this one be.
      if (error && error.code !== "23505") console.error("findOrCreateCustomer: update failed", error);
    }
    return existing.id;
  }

  const { data, error } = await admin
    .from("customers")
    .insert({
      name: input.name || null,
      email,
      phone: e164 ? input.phone : null,
      phone_e164: e164,
      postcode: input.postcode || null,
      conversation_id: input.conversationId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("findOrCreateCustomer: insert failed", error);
    return null;
  }
  return data.id as string;
}

/**
 * The signed-in customer's own record: the one already linked to their
 * login, else the one with their email (linked now), else a new one. Never
 * hands a staff member's login a customer record.
 */
export async function customerForUser(userId: string, email: string | null | undefined): Promise<Customer | null> {
  const admin = createAdminClient();
  const { data: linked } = await admin.from("customers").select("*").eq("user_id", userId).maybeSingle();
  if (linked) return mapCustomer(linked as Row);
  const lower = email?.trim().toLowerCase();
  if (!lower) return null;

  const { data: byEmail } = await admin.from("customers").select("*").eq("email", lower).is("user_id", null).maybeSingle();
  if (byEmail) {
    const { data } = await admin.from("customers").update({ user_id: userId }).eq("id", (byEmail as Row).id).select("*").single();
    return data ? mapCustomer(data as Row) : mapCustomer(byEmail as Row);
  }
  const { data: created } = await admin.from("customers").insert({ user_id: userId, email: lower }).select("*").single();
  return created ? mapCustomer(created as Row) : null;
}

// ---------------------------------------------------------------------------
// The team's private notes.

export async function listCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const { data } = await createAdminClient()
    .from("customer_notes")
    .select("id, body, author_id, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    authorId: (r.author_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function addCustomerNote(customerId: string, body: string, authorId: string): Promise<boolean> {
  const text = body.trim().slice(0, 4000);
  if (!text) return false;
  const { error } = await createAdminClient().from("customer_notes").insert({ customer_id: customerId, body: text, author_id: authorId });
  return !error;
}

export async function deleteCustomerNote(noteId: string, customerId: string): Promise<boolean> {
  const { error } = await createAdminClient().from("customer_notes").delete().eq("id", noteId).eq("customer_id", customerId);
  return !error;
}
