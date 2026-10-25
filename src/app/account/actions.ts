"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHAT_ON } from "@/lib/chat-on";
import { CLUB_SITE_URL } from "@/lib/club";
import { isValidEmail } from "@/lib/validation";
import { PREVIOUS_GUEST_COOKIE } from "@/lib/account-claim";
import { customerFieldsFromForm, customerForUser, updateCustomer } from "@/lib/customers";
import { createRequest } from "@/lib/appointments";
import { postCustomerVisitMessage, sendVisitNotice } from "@/lib/visit-notify";
import { requestedWhen } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { KIND_LABEL, REQUESTABLE_KINDS, addDays, isISODate, isPart, type AppointmentKind } from "@/lib/day-plan";

/**
 * Emails the customer a sign-in link: no password to remember. Their
 * account is made the first time; anything already on file under that
 * email (a booking, the chat) is theirs once they're in.
 */
export async function sendSignInLink(formData: FormData) {
  if (!CHAT_ON) redirect("/account");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) redirect(`/account?error=${encodeURIComponent("Enter a valid email address.")}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Chatting as a guest in this browser: bring that conversation along.
  if (user?.is_anonymous) {
    (await cookies()).set(PREVIOUS_GUEST_COOKIE, user.id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 });
  }

  const origin = (await headers()).get("origin") || CLUB_SITE_URL;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/account`, shouldCreateUser: true },
  });
  if (error) {
    console.error("sendSignInLink failed", error);
    redirect(`/account?error=${encodeURIComponent("Couldn't send the link just now. Please try again in a minute.")}`);
  }
  redirect(`/account?sent=${encodeURIComponent(email)}`);
}

async function requireCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/account");
  const customer = await customerForUser(user.id, user.email);
  if (!customer) redirect("/account");
  return customer;
}

/** The customer's own details and boiler. Their email is their login, so it isn't on the form. */
export async function updateMyDetails(formData: FormData) {
  const customer = await requireCustomer();
  formData.delete("email");
  const parsed = customerFieldsFromForm(formData);
  if (!parsed.ok) redirect(`/account?error=${encodeURIComponent(parsed.error)}#details`);
  const result = await updateCustomer(customer.id, parsed.fields);
  if (!result.ok) {
    const error = result.error.startsWith("Another customer") ? "That number is already on another account. Message us and we'll sort it." : result.error;
    redirect(`/account?error=${encodeURIComponent(error)}#details`);
  }
  revalidatePath("/account");
  redirect("/account?saved=1#details");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/account");
}

/**
 * A signed-in customer asking for a visit: it goes on the team's schedule as
 * a request on that day (morning, afternoon or any time), in their
 * conversation as their message, and they get an "it's in" message back
 * with the link to their visit.
 */
export async function requestVisit(formData: FormData) {
  const customer = await requireCustomer();
  const kind = String(formData.get("kind") ?? "") as AppointmentKind;
  const day = String(formData.get("day") ?? "");
  const part = String(formData.get("part") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const today = londonNow().dateISO;
  if (!(REQUESTABLE_KINDS as readonly string[]).includes(kind) || !isISODate(day) || day < today || day > addDays(today, 60) || !isPart(part)) {
    redirect(`/account?requestError=${encodeURIComponent("Pick what you need, a day and a time of day.")}#request`);
  }
  const visit = await createRequest({
    customerId: customer.id,
    kind,
    day,
    part,
    note,
    address: customer.address,
    postcode: customer.postcode,
    source: "account",
  });
  if (!visit) redirect(`/account?requestError=${encodeURIComponent("Couldn't send that just now. Please try again.")}#request`);
  await postCustomerVisitMessage(
    customer,
    `I'd like to book a ${KIND_LABEL[kind].toLowerCase()} on ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}.${note ? `\n${note}` : ""}`,
  );
  await sendVisitNotice(visit.id, "requested", null);
  revalidatePath("/account");
  redirect("/account?requested=1#visits");
}
