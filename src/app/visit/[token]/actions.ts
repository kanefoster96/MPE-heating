"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppointmentByToken, setChangeRequest } from "@/lib/appointments";
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
  if (!visit || !visit.customerId || (visit.status !== "booked" && visit.status !== "requested")) redirect(`/visit/${token}`);
  const day = String(formData.get("day") ?? "");
  const part = String(formData.get("part") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const today = londonNow().dateISO;
  if (!isISODate(day) || day < today || day > addDays(today, 60) || !isPart(part)) {
    redirect(`/visit/${token}?error=${encodeURIComponent("Pick a day and a time of day.")}#another-time`);
  }
  const customer = await getCustomer(visit.customerId);
  if (!customer) redirect(`/visit/${token}`);

  if (visit.status === "requested") {
    const window = PART_WINDOW[part];
    await createAdminClient()
      .from("appointments")
      .update({ day, part, start_minute: window.start, end_minute: window.end, updated_at: new Date().toISOString() })
      .eq("id", visit.id)
      .eq("status", "requested");
    await postCustomerVisitMessage(
      customer,
      `I've changed my ${KIND_LABEL[visit.kind].toLowerCase()} request to ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}.${note ? `\n${note}` : ""}`,
    );
  } else {
    await setChangeRequest(visit.id, { day, part, note });
    await postCustomerVisitMessage(
      customer,
      `I can't make my ${KIND_LABEL[visit.kind].toLowerCase()} on ${longDate(visit.day)}, ${windowLabel(visit.start, visit.end)}. Could you do ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}?${note ? `\n${note}` : ""}`,
    );
  }
  revalidatePath(`/visit/${token}`);
  revalidatePath("/staff/schedule");
  redirect(`/visit/${token}?asked=1`);
}
