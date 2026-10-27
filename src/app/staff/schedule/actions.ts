"use server";

import { releasePaidCallout } from "@/lib/callout-prepay";
import { londonNow } from "@/lib/schedule-time";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import {
  acceptRequest,
  appointmentFromForm,
  clearChangeRequest,
  createAppointment,
  deleteAppointment,
  getAppointment,
  markEnquiryBooked,
  setAppointmentStatus,
  updateAppointment,
} from "@/lib/appointments";
import { reachedThem, sendOnMyWay, sendRunningLate, sendVisitNotice, viaPhrase } from "@/lib/visit-notify";
import type { NoticeType } from "@/lib/visit-copy";
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
  if (parsed.input.day < londonNow().dateISO) redirect(dayHref(day, { error: "That day's gone. Pick today or later.", add: "1" }));
  const id = await createAppointment(parsed.input, user.id);
  if (!id) redirect(dayHref(day, { error: "Couldn't add that visit.", add: "1" }));
  const sent = wantsNotice(formData) && parsed.input.customerId ? await sendVisitNotice(id, "booked", user.id) : null;
  revalidatePath("/staff/schedule");
  redirect(dayHref(parsed.input.day, { success: "added", ...sentParam(sent) }) + `#visit-${id}`);
}

/**
 * Saves a visit. Saving a customer's request books it; changing the day or
 * time of a booked one moves it (and answers any request to move it). With
 * "let them know" ticked, the customer is told which.
 */
export async function editAppointment(id: string, formData: FormData) {
  const user = await requireStaff("/staff/schedule");
  const day = back(formData);
  const before = await getAppointment(id);
  if (!before) redirect(dayHref(day, { error: "That visit's gone." }));
  const customerError = await newCustomerFromForm(formData);
  if (customerError) redirect(dayHref(day, { error: customerError, edit: id }));
  const parsed = appointmentFromForm(formData);
  if (!parsed.ok) redirect(dayHref(day, { error: parsed.error, edit: id }));
  const input = parsed.input;
  const timeChanged = input.day !== before.day || input.start !== before.start || input.end !== before.end;
  // A request, or a missed visit given a new time, is booked on save.
  const wasRequest = before.status === "requested" || (before.status === "no_access" && timeChanged);
  // Booking (or moving) onto a day that's gone would tell the customer a date that's passed.
  if ((wasRequest || timeChanged) && input.day < londonNow().dateISO) {
    redirect(dayHref(day, { error: "That day's gone. Pick today or later.", edit: id }));
  }
  const ok = await updateAppointment(id, input, {
    status: wasRequest ? "booked" : undefined,
    clearChange: wasRequest || timeChanged,
  });
  if (!ok) redirect(dayHref(day, { error: "Couldn't save that visit.", edit: id }));
  if (wasRequest && before.enquiryId) await markEnquiryBooked(before.enquiryId, user.id);

  const notice: NoticeType | null = wasRequest || before.customerId !== input.customerId ? "booked" : timeChanged && before.status === "booked" ? "moved" : null;
  const sent = notice && wantsNotice(formData) && input.customerId ? await sendVisitNotice(id, notice, user.id) : null;
  revalidatePath("/staff/schedule");
  redirect(dayHref(input.day, { success: wasRequest ? "accepted" : "saved", ...sentParam(sent) }) + `#visit-${id}`);
}

export async function changeAppointmentStatus(id: string, status: AppointmentStatus, day: string) {
  await requireStaff("/staff/schedule");
  await setAppointmentStatus(id, status);
  // Cancelled after they'd paid the call-out ahead: it counts for their next visit (lib/callout-prepay.ts).
  if (status === "cancelled") await releasePaidCallout(id);
  revalidatePath("/staff/schedule");
  revalidatePath("/staff/customers");
  redirect(dayHref(day) + `#visit-${id}`);
}

/** Accepts a customer's request in the window they asked for, and tells them. */
export async function acceptVisitRequest(id: string, day: string) {
  const user = await requireStaff("/staff/schedule");
  const asked = await getAppointment(id);
  if (asked && asked.day < londonNow().dateISO) {
    redirect(dayHref(day, { error: "That day's gone. Change the time instead, and they'll be told." }) + `#visit-${id}`);
  }
  await acceptRequest(id);
  const visit = await getAppointment(id);
  if (visit?.enquiryId) await markEnquiryBooked(visit.enquiryId, user.id);
  const sent = await sendVisitNotice(id, "booked", user.id);
  revalidatePath("/staff/schedule");
  redirect(dayHref(day, { success: "accepted", ...sentParam(sent) }) + `#visit-${id}`);
}

/** The customer asked to move, and it's staying put (talked it over, say). */
export async function keepVisitTime(id: string, day: string) {
  await requireStaff("/staff/schedule");
  await clearChangeRequest(id);
  revalidatePath("/staff/schedule");
  redirect(dayHref(day) + `#visit-${id}`);
}

/** Sends the customer the details again, or tells them it's cancelled. */
export async function sendVisitDetails(id: string, day: string) {
  const user = await requireStaff("/staff/schedule");
  const visit = await getAppointment(id);
  if (!visit?.customerId) redirect(dayHref(day));
  const type: NoticeType =
    visit.status === "cancelled" ? "cancelled" : visit.status === "no_access" ? "missed" : visit.lastNotice === "moved" ? "moved" : "booked";
  const sent = await sendVisitNotice(id, type, user.id);
  revalidatePath("/staff/schedule");
  redirect(dayHref(day, { success: "sent", ...sentParam(sent) }) + `#visit-${id}`);
}

function wantsNotice(formData: FormData): boolean {
  return formData.get("notify") === "on";
}

function sentParam(sent: string[] | null): Record<string, string> {
  // Only their conversation, which someone who's only phoned can't see: not sent, as far as they're concerned.
  return sent === null ? {} : { sent: reachedThem(sent) ? sent.join(",") : "none" };
}

/** "On my way": tells the customer who's coming and roughly when. */
export async function onMyWay(id: string, day: string, formData: FormData) {
  const user = await requireStaff("/staff/schedule");
  const eta = Number(formData.get("eta"));
  const sent = await sendOnMyWay(id, user.id, eta);
  revalidatePath("/staff/schedule");
  const note = sent.length ? `Sent "on my way" by ${viaPhrase(sent)}.` : "Couldn't reach them: add a mobile or email to their customer page.";
  redirect(dayHref(day, { success: "onmyway", note }) + `#visit-${id}`);
}

/** "Running late": the arrival window moves on, and they're told the new one. */
export async function runningLate(id: string, day: string, formData: FormData) {
  const user = await requireStaff("/staff/schedule");
  const result = await sendRunningLate(id, user.id, Number(formData.get("minutes")));
  revalidatePath("/staff/schedule");
  const note = !result ? "Couldn't move that visit." : `Now ${result.window}.${result.via.length ? ` Told them by ${viaPhrase(result.via)}.` : " Couldn't reach them: give them a call."}`;
  redirect(dayHref(day, { success: "onmyway", note }) + `#visit-${id}`);
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
