"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import {
  appointmentFromForm,
  createAppointment,
  deleteAppointment,
  setAppointmentStatus,
  updateAppointment,
} from "@/lib/appointments";
import { createCustomer, customerFieldsFromForm, customerLabel, listCustomers } from "@/lib/customers";
import type { AppointmentStatus } from "@/lib/day-plan";

function dayHref(day: string, extra: Record<string, string> = {}) {
  return `/staff/schedule?${new URLSearchParams({ view: "day", date: day, ...extra }).toString()}`;
}

function back(formData: FormData): string {
  const day = String(formData.get("day") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

/**
 * A new customer typed into the visit form (name, mobile, email): made
 * first, then the visit is booked for them. Returns an error to show, or
 * null when there's nothing new or it worked.
 */
async function newCustomerFromForm(formData: FormData): Promise<string | null> {
  if (formData.get("customerId") || !(formData.get("newName") || formData.get("newPhone") || formData.get("newEmail"))) return null;
  const fields = new FormData();
  fields.set("name", String(formData.get("newName") ?? ""));
  fields.set("phone", String(formData.get("newPhone") ?? ""));
  fields.set("email", String(formData.get("newEmail") ?? ""));
  fields.set("address", String(formData.get("address") ?? ""));
  fields.set("postcode", String(formData.get("postcode") ?? ""));
  const parsed = customerFieldsFromForm(fields);
  if (!parsed.ok) return parsed.error;
  const created = await createCustomer(parsed.fields);
  if (!created.ok) return created.error;
  formData.set("customerId", created.id);
  return null;
}

/** Adds a visit, for an existing customer, a new one, or nobody (a title). */
export async function addAppointment(formData: FormData) {
  const user = await requireStaff("/staff/schedule");
  const day = back(formData);
  const customerError = await newCustomerFromForm(formData);
  if (customerError) redirect(dayHref(day, { error: customerError, add: "1" }));

  const parsed = appointmentFromForm(formData);
  if (!parsed.ok) redirect(dayHref(day, { error: parsed.error, add: "1" }));
  const id = await createAppointment(parsed.input, user.id);
  if (!id) redirect(dayHref(day, { error: "Couldn't add that visit.", add: "1" }));
  revalidatePath("/staff/schedule");
  redirect(dayHref(parsed.input.day, { success: "added" }) + `#visit-${id}`);
}

export async function editAppointment(id: string, formData: FormData) {
  await requireStaff("/staff/schedule");
  const day = back(formData);
  const customerError = await newCustomerFromForm(formData);
  if (customerError) redirect(dayHref(day, { error: customerError, edit: id }));
  const parsed = appointmentFromForm(formData);
  if (!parsed.ok) redirect(dayHref(day, { error: parsed.error, edit: id }));
  if (!(await updateAppointment(id, parsed.input))) redirect(dayHref(day, { error: "Couldn't save that visit.", edit: id }));
  revalidatePath("/staff/schedule");
  redirect(dayHref(parsed.input.day, { success: "saved" }) + `#visit-${id}`);
}

export async function changeAppointmentStatus(id: string, status: AppointmentStatus, day: string) {
  await requireStaff("/staff/schedule");
  await setAppointmentStatus(id, status);
  revalidatePath("/staff/schedule");
  revalidatePath("/staff/customers");
  redirect(dayHref(day) + `#visit-${id}`);
}

export async function removeAppointment(id: string, day: string) {
  await requireStaff("/staff/schedule");
  await deleteAppointment(id);
  revalidatePath("/staff/schedule");
  redirect(dayHref(day, { success: "removed" }));
}

export type CustomerOption = { id: string; label: string; sub: string; address: string; postcode: string };

/** The customer picker on the add-visit form: name, email, phone or postcode. */
export async function searchCustomerOptions(q: string): Promise<CustomerOption[]> {
  await requireStaff("/staff/schedule");
  const found = await listCustomers(q, 8);
  return found.map((c) => ({
    id: c.id,
    label: customerLabel(c),
    sub: [c.postcode, c.phone, c.name ? c.email : null].filter(Boolean).join(" · "),
    address: c.address ?? "",
    postcode: c.postcode ?? "",
  }));
}
