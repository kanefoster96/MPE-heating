"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getEnquiryByToken, visitKindFor } from "@/lib/enquiries";
import { createRequest } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { postCustomerVisitMessage, sendVisitNotice } from "@/lib/visit-notify";
import { requestedWhen } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { KIND_LABEL, addDays, isISODate, isPart } from "@/lib/day-plan";

/**
 * A customer picking a time for the booking form they sent (from a
 * follow-up's link): a request on the team's schedule, their message in the
 * conversation, and "we've got it" back with their visit link.
 */
export async function pickTimeForEnquiry(token: string, formData: FormData) {
  const enquiry = await getEnquiryByToken(token);
  if (!enquiry?.customerId) redirect(`/request/${token}`);
  const day = String(formData.get("day") ?? "");
  const part = String(formData.get("part") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const today = londonNow().dateISO;
  if (!isISODate(day) || day < today || day > addDays(today, 60) || !isPart(part)) {
    redirect(`/request/${token}?error=${encodeURIComponent("Pick a day and a time of day.")}`);
  }
  const customer = await getCustomer(enquiry.customerId);
  if (!customer) redirect(`/request/${token}`);
  const kind = visitKindFor(enquiry.category);
  const visit = await createRequest({
    customerId: customer.id,
    enquiryId: enquiry.id,
    kind,
    day,
    part,
    note,
    address: customer.address,
    postcode: enquiry.postcode ?? customer.postcode,
    source: "website",
  });
  if (!visit) redirect(`/request/${token}?error=${encodeURIComponent("Couldn't send that just now. Please try again.")}`);
  await postCustomerVisitMessage(
    customer,
    `Could you come for the ${KIND_LABEL[kind].toLowerCase()} on ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}?${note ? `\n${note}` : ""}`,
  );
  await sendVisitNotice(visit.id, "requested", null);
  revalidatePath("/staff/schedule");
  redirect(`/visit/${visit.publicToken}`);
}
