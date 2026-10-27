import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateCustomer } from "@/lib/customers";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { normalizePhone } from "@/lib/phone";
import { formatPostcode, isValidEmail, isValidPostcode } from "@/lib/validation";
import { teamHours } from "@/lib/team-hours";
import {
  AFTER_HOURS_BODY,
  APP_PROMPT_BODY,
  DETAILS_ASK_AFTER_HOURS,
  DETAILS_ASK_BOTH,
  DETAILS_ASK_EMAIL,
  DETAILS_ASK_MOBILE,
  NO_APP_PROMPT_BODY,
  WELCOME_BODY,
  appLinks,
} from "@/lib/chat-welcome-copy";

/**
 * MPE's live chat flow, on top of Kanvas Academy's chat:
 *
 *   1. The chat opens with a welcome: "How can we help today?"
 *   2. After the customer's first message, we ask for their email (and
 *      their mobile, if we don't already have it) so an engineer can get
 *      back to them even if they close the page.
 *   3. Once they've left them, we suggest the app, so they hear the moment
 *      an engineer replies (or say we'll email them, until the app is out).
 *
 * Each step is sent once per conversation: the stamp is set first, with a
 * "still empty" condition, and only the request that set it sends the
 * message — so two tabs or a double tap never send anything twice.
 * The messages are sent by MPE itself (no sender), like the Academy's
 * automatic email prompt.
 */

type Admin = ReturnType<typeof createAdminClient>;

/** Sets `column` to now only if it's still empty; true if this call set it. */
async function claimOnce(admin: Admin, conversationId: string, column: string): Promise<boolean> {
  const { data, error } = await admin
    .from("chat_conversations")
    .update({ [column]: new Date().toISOString() })
    .eq("id", conversationId)
    .is(column, null)
    .select("id");
  if (error) {
    console.error(`chat flow: could not set ${column}`, error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function sendAsMpe(admin: Admin, conversationId: string, body: string): Promise<void> {
  const { error } = await admin.from("chat_messages").insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_is_coach: true,
    body,
  });
  if (error) console.error("chat flow: message insert failed", error);
}

/** Step 1: the welcome, when the chat is first opened. */
export async function ensureWelcome(conversationId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // A chat that's already going (their booking, our texts): no "welcome" in the middle of it.
    const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
    if ((await claimOnce(admin, conversationId, "welcome_sent_at")) && !count) {
      await sendAsMpe(admin, conversationId, WELCOME_BODY);
    }
  } catch (err) {
    console.error("ensureWelcome failed", err);
  }
}

/**
 * 8pm to 8am: that the team aren't on the chat, when they're back, and the
 * gas emergency number. Once a night per conversation (12 hours apart).
 */
async function sendAfterHours(admin: Admin, conversationId: string): Promise<void> {
  const now = new Date();
  const { data, error } = await admin
    .from("chat_conversations")
    .update({ after_hours_sent_at: now.toISOString() })
    .eq("id", conversationId)
    .or(`after_hours_sent_at.is.null,after_hours_sent_at.lt.${new Date(now.getTime() - 12 * 3_600_000).toISOString()}`)
    .select("id");
  if (error) {
    console.error("chat flow: could not set after_hours_sent_at", error);
    return;
  }
  if (data?.length) await sendAsMpe(admin, conversationId, AFTER_HOURS_BODY);
}

async function sendAppPrompt(admin: Admin, conversationId: string): Promise<void> {
  if (!(await claimOnce(admin, conversationId, "app_prompt_sent_at"))) return;
  const { appStore, playStore } = appLinks();
  await sendAsMpe(admin, conversationId, appStore || playStore ? APP_PROMPT_BODY : NO_APP_PROMPT_BODY);
}

/**
 * Step 2, after each customer message: ask for whatever we can't reach
 * them on yet, once. Someone we can already reach (a signed-in account
 * with an email, or details given) goes straight to the app suggestion.
 * Someone writing from the app gets neither.
 */
export async function afterCustomerMessage(conversationId: string, accountEmail: string | null, source: "web" | "app" = "web"): Promise<void> {
  try {
    const admin = createAdminClient();
    const afterHours = !teamHours();
    // In the app they get a push when we reply, and are already in the app.
    if (source === "app") {
      await claimOnce(admin, conversationId, "app_prompt_sent_at");
      if (afterHours) await sendAfterHours(admin, conversationId);
      return;
    }
    const { data: c } = await admin
      .from("chat_conversations")
      .select("guest_email, phone, details_asked_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (!c) return;
    const needEmail = !accountEmail && !c.guest_email;
    const needMobile = !c.phone;
    if (needEmail || needMobile) {
      if (c.details_asked_at || !(await claimOnce(admin, conversationId, "details_asked_at"))) {
        if (afterHours) await sendAfterHours(admin, conversationId);
        return;
      }
      if (afterHours) {
        // The ask says the team are back at 8am, so it counts as tonight's notice.
        await admin.from("chat_conversations").update({ after_hours_sent_at: new Date().toISOString() }).eq("id", conversationId);
        await sendAsMpe(admin, conversationId, DETAILS_ASK_AFTER_HOURS);
      } else {
        await sendAsMpe(admin, conversationId, needEmail && needMobile ? DETAILS_ASK_BOTH : needEmail ? DETAILS_ASK_EMAIL : DETAILS_ASK_MOBILE);
      }
      return;
    }
    if (afterHours) await sendAfterHours(admin, conversationId);
    await sendAppPrompt(admin, conversationId);
  } catch (err) {
    console.error("afterCustomerMessage failed", err);
  }
}

export type SaveDetailsResult = { success: true } | { success: false; error: string };

/**
 * Step 3: the customer left their details in the form under the ask. Saves
 * them on the conversation (so replies can be emailed or texted), tells
 * the team, then suggests the app.
 */
export async function saveCustomerDetails(
  conversationId: string,
  customerUserId: string,
  input: { name?: string; postcode?: string; email?: string; mobile?: string },
): Promise<SaveDetailsResult> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const mobileTyped = input.mobile?.trim() ?? "";
  const name = input.name?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
  if (input.name !== undefined && name.length < 2) return { success: false, error: "Enter your name." };
  const postcode = input.postcode?.trim().toUpperCase().replace(/\s+/g, " ").slice(0, 10) ?? "";
  if (postcode && !isValidPostcode(postcode)) return { success: false, error: "Check your postcode, e.g. NE26 1AB." };
  if (input.email !== undefined && !isValidEmail(email)) return { success: false, error: "Enter a valid email address." };
  const mobile = mobileTyped ? normalizePhone(mobileTyped) : null;
  if (input.mobile !== undefined && !mobile) return { success: false, error: "Enter a valid UK mobile number, e.g. 07123 456789." };

  const admin = createAdminClient();
  const update: Record<string, string> = {};
  if (email) update.guest_email = email;
  if (mobile) update.phone = mobile;
  if (name) update.guest_name = name;
  if (Object.keys(update).length === 0) return { success: false, error: "Add your details first." };

  let { error } = await admin.from("chat_conversations").update(update).eq("id", conversationId);
  // The number is already on another conversation (they've texted or called
  // before): keep the email here, and put the number in the chat instead so
  // the team still has it.
  if (error?.code === "23505" && mobile) {
    delete update.phone;
    ({ error } = Object.keys(update).length
      ? await admin.from("chat_conversations").update(update).eq("id", conversationId)
      : { error: null });
    await admin.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: customerUserId,
      sender_is_coach: false,
      body: `My mobile number is ${mobileTyped}`,
    });
  }
  if (error) {
    console.error("saveCustomerDetails: update failed", error);
    return { success: false, error: "Couldn't save your details. Please try again." };
  }

  // Their customer record, for the schedule and the team's customer pages.
  const { data: convo } = await admin.from("chat_conversations").select("guest_name").eq("id", conversationId).maybeSingle();
  await findOrCreateCustomer(admin, {
    name: name || ((convo?.guest_name as string | null) ?? null),
    email: email || null,
    phone: mobile ? mobileTyped : null,
    postcode: postcode ? formatPostcode(postcode) : null,
    conversationId,
  });

  await notifyStaffOfFamilyMessage({
    conversationId,
    fromName: name ? `${name} · website chat` : "Website chat",
    body: `Left their details: ${[postcode ? formatPostcode(postcode) : "", email, mobileTyped].filter(Boolean).join(" · ")}`,
  });
  await sendAppPrompt(admin, conversationId);
  return { success: true };
}
