"use server";

import { redirect } from "next/navigation";
import { isDayOff } from "@/lib/days-off";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppointmentByToken, markCantMake, setChangeRequest } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { postCustomerVisitMessage } from "@/lib/visit-notify";
import { requestedWhen } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { KIND_LABEL, PART_WINDOW, addDays, isISODate, isPart, longDate, windowLabel } from "@/lib/day-plan";

/**
 * "Can't make it?" from the customer's visit page: the day and part of the
 * day that suits them instead, and a note. A booked visit keeps its time and
 * shows the team the ask (they move it, or talk it over); a request that
 * hasn't been accepted yet simply changes. Either way it lands in their
 * conversation and every admin and engineer gets a push.
 */
export async function askForAnotherTime(token: string, formData: FormData) {
  const visit = await getAppointmentByToken(token);
  if (!visit || !visit.customerId || !["booked", "requested", "no_access"].includes(visit.status)) redirect(`/visit/${token}`);
  const day = String(formData.get("day") ?? "");
  const part = String(formData.get("part") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const today = londonNow().dateISO;
  if (!isISODate(day) || day < today || day > addDays(today, 60) || !isPart(part)) {
    redirect(`/visit/${token}?error=${encodeURIComponent("Pick a day and a time of day.")}#another-time`);
  }
  if (await isDayOff(day)) redirect(`/visit/${token}?error=${encodeURIComponent("We're not working that day. Please pick another.")}#another-time`);
  const customer = await getCustomer(visit.customerId);
  if (!customer) redirect(`/visit/${token}`);

  if (visit.status === "requested") {
    const window = PART_WINDOW[part];
    await createAdminClient()
      .from("appointments")
      // A new day: its nudge to the team and its "we didn't get to you" can come again.
      .update({ day, part, start_minute: window.start, end_minute: window.end, updated_at: new Date().toISOString(), staff_nudged_at: null, past_request_sent_at: null })
      .eq("id", visit.id)
      .eq("status", "requested");
    await postCustomerVisitMessage(
      customer,
      `I've changed my ${KIND_LABEL[visit.kind].toLowerCase()} request to ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}.${note ? `\n${note}` : ""}`,
    );
  } else if (visit.status === "no_access") {
    await setChangeRequest(visit.id, { day, part, note });
    await postCustomerVisitMessage(
      customer,
      `Sorry I missed you on ${longDate(visit.day)}. Could you come back on ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}?${note ? `\n${note}` : ""}`,
    );
  } else {
    await setChangeRequest(visit.id, { day, part, note });
    await postCustomerVisitMessage(
      customer,
      `I can't make my ${visit.followUpOf ? "return visit" : KIND_LABEL[visit.kind].toLowerCase()} on ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}. Could you do ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}?${note ? `\n${note}` : ""}`,
    );
  }
  revalidatePath(`/visit/${token}`);
  revalidatePath("/staff/schedule");
  redirect(`/visit/${token}?asked=1`);
}

/**
 * "I won't be in", from the visit page (the link in every reminder and the
 * running-late message): the team's told in their chat straight away, the
 * reminders stop, and the page offers another time and the live chat.
 */
export async function cantBeIn(token: string) {
  const visit = await getAppointmentByToken(token);
  if (!visit || !visit.customerId || visit.status !== "booked") redirect(`/visit/${token}`);
  const customer = await getCustomer(visit.customerId);
  if (customer && (await markCantMake(visit.id))) {
    const what = visit.followUpOf ? "return visit" : KIND_LABEL[visit.kind].toLowerCase();
    await postCustomerVisitMessage(customer, `I won't be in for my ${what} on ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}. I'll need to rebook.`);
  }
  revalidatePath(`/visit/${token}`);
  revalidatePath("/staff/schedule");
  redirect(`/visit/${token}#another-time`);
}
