import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation, getOrCreateConversationByPhone } from "@/lib/chat-db";
import type { Conversation } from "@/lib/chat";
import { notifyStaffOfFamilyMessage } from "@/lib/chat-routing";
import { normalizePhone } from "@/lib/phone";
import type { EnquiryType } from "@/lib/enquiry";
import { findOrCreateCustomer } from "@/lib/customers";
import { createRequest } from "@/lib/appointments";
import { sendVisitNotice } from "@/lib/visit-notify";
import type { Part } from "@/lib/day-plan";

/**
 * Booking enquiries, filed as jobs. MPE's own addition to Kanvas Academy's
 * messaging: every booking form is saved in `enquiries` with its category,
 * and posted into that customer's chat conversation as a summary, so the
 * team sees it in the inbox alongside the customer's texts, calls and chat
 * (and can reply from there by chat, text or email).
 */

export const ENQUIRY_CATEGORIES = ["callout", "new_boiler", "service", "plan", "commercial", "other"] as const;
export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<EnquiryCategory, string> = {
  callout: "Call-out",
  new_boiler: "New boiler",
  service: "Service",
  plan: "Plan",
  commercial: "Commercial",
  other: "Other",
};

export const ENQUIRY_STATUSES = ["new", "contacted", "booked", "done", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Booked",
  done: "Done",
  closed: "Closed",
};

/** The form's enquiry type, as a job category. */
export function categoryFor(type: EnquiryType): EnquiryCategory {
  switch (type) {
    case "repair":
      return "callout";
    case "quote":
      return "new_boiler";
    case "service":
      return "service";
    case "plan":
      return "plan";
    case "commercial":
      return "commercial";
    default:
      return "other";
  }
}

export type Enquiry = {
  id: string;
  conversationId: string | null;
  customerId: string | null;
  category: EnquiryCategory;
  status: EnquiryStatus;
  name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  sameDay: boolean;
  path: string[];
  answers: { q: string; a: string }[];
  message: string | null;
  createdAt: string;
  /** Their link to pick a time (/request/<token>). */
  publicToken: string;
  /** How many follow-ups they've had (lib/follow-up-sweep.ts), and when the last went. */
  followupCount: number;
  followedUpAt: string | null;
  staffNudgedAt: string | null;
};

type Row = {
  id: string;
  conversation_id: string | null;
  customer_id: string | null;
  category: EnquiryCategory;
  status: EnquiryStatus;
  name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  same_day: boolean;
  path: string[] | null;
  answers: { q: string; a: string }[] | null;
  message: string | null;
  created_at: string;
  public_token: string;
  followup_count: number | null;
  followed_up_at: string | null;
  staff_nudged_at: string | null;
};

function mapEnquiry(r: Row): Enquiry {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    customerId: r.customer_id ?? null,
    category: r.category,
    status: r.status,
    name: r.name,
    email: r.email,
    phone: r.phone,
    postcode: r.postcode,
    sameDay: r.same_day,
    path: r.path ?? [],
    answers: Array.isArray(r.answers) ? r.answers : [],
    message: r.message,
    createdAt: r.created_at,
    publicToken: r.public_token,
    followupCount: r.followup_count ?? 0,
    followedUpAt: r.followed_up_at ?? null,
    staffNudgedAt: r.staff_nudged_at ?? null,
  };
}

/** Whether enquiries can be saved: the Supabase service key is set. */
export function enquiriesOn(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * A conversation for someone who only gave an email (the quick email
 * fields): theirs if we have one, else a contact made for them, like the
 * Academy's phone-only contacts for texts and calls.
 */
async function conversationByEmail(email: string, name: string | null): Promise<Conversation | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("chat_conversations").select("user_id").eq("guest_email", email).limit(1).maybeSingle();
  if (existing?.user_id) return getOrCreateConversation(existing.user_id as string);

  const { data: userId } = await admin.rpc("user_id_for_email", { check_email: email });
  if (userId) return getOrCreateConversation(userId as string);

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { email_guest: true, ...(name ? { full_name: name } : {}) },
  });
  if (error || !created.user) return null;
  const conversation = await getOrCreateConversation(created.user.id, name ?? undefined);
  if (conversation) await admin.from("chat_conversations").update({ guest_email: email }).eq("id", conversation.id);
  return conversation;
}

/** The summary posted into the customer's conversation. */
export function enquirySummary(input: {
  label: string;
  sameDay: boolean;
  postcode: string;
  answers: { q: string; a: string }[];
  message: string;
  name: string;
  email: string;
  phone: string;
}): string {
  const lines = [
    `New booking: ${input.label}${input.sameDay ? " (same day requested)" : ""}`,
    ...input.answers.filter((a) => a.q !== "Postcode").map((a) => `${a.q}: ${a.a}`),
    ...(input.postcode ? [`Postcode: ${input.postcode}`] : []),
    ...(input.message && !input.answers.some((a) => a.a === input.message) ? [`Details: ${input.message}`] : []),
    [input.name, input.email, input.phone].filter(Boolean).join(" · "),
  ];
  return lines.join("\n");
}

/**
 * Files a booking form: the customer's conversation (found by mobile, then
 * email, or made), the summary message in it, the enquiry row, and a push
 * to the team. Returns false if it couldn't be saved (the caller still
 * emails it, so nothing is lost).
 */
export async function recordEnquiry(input: {
  type: EnquiryType;
  label: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  sameDay: boolean;
  path: string[];
  answers: { q: string; a: string }[];
  message: string;
  /** From the "when suits you" step: becomes a request on the team's schedule. */
  preferred?: { day: string; part: Part } | null;
}): Promise<boolean> {
  if (!enquiriesOn()) return false;
  try {
    const admin = createAdminClient();
    const e164 = input.phone ? normalizePhone(input.phone) : null;
    const name = input.name || null;
    const conversation = e164
      ? await getOrCreateConversationByPhone(e164, name)
      : input.email
        ? await conversationByEmail(input.email.toLowerCase(), name)
        : null;

    if (conversation) {
      // Fill in what we didn't have, never overwrite what the team set.
      const fill: Record<string, string> = {};
      if (name && !conversation.guestName) fill.guest_name = name;
      if (input.email && !conversation.guestEmail) fill.guest_email = input.email.toLowerCase();
      const now = new Date().toISOString();
      await admin
        .from("chat_conversations")
        .update({ ...fill, last_message_at: now, completed_at: null, completed_by: null })
        .eq("id", conversation.id);
      await admin.from("chat_messages").insert({
        conversation_id: conversation.id,
        sender_id: conversation.userId,
        sender_is_coach: false,
        body: enquirySummary(input),
      });
    }

    // Every booking has a customer record (lib/customers.ts) for the
    // schedule and the customer pages.
    const customerId = await findOrCreateCustomer(admin, {
      name,
      email: input.email,
      phone: input.phone,
      postcode: input.postcode,
      conversationId: conversation?.id ?? null,
    });

    const { data: inserted, error } = await admin.from("enquiries").insert({
      conversation_id: conversation?.id ?? null,
      customer_id: customerId,
      category: categoryFor(input.type),
      name,
      email: input.email || null,
      phone: input.phone || null,
      phone_e164: e164,
      postcode: input.postcode || null,
      same_day: input.sameDay,
      path: input.path,
      answers: input.answers,
      message: input.message || null,
    }).select("id").single();
    if (error) {
      console.error("recordEnquiry: insert failed", error);
      return false;
    }

    // The day they picked goes on the schedule as a request, and they get
    // a message back with the link to it.
    if (input.preferred && customerId && inserted) {
      const visit = await createRequest({
        customerId,
        enquiryId: inserted.id as string,
        kind: visitKindFor(categoryFor(input.type)),
        day: input.preferred.day,
        part: input.preferred.part,
        postcode: input.postcode || null,
        source: "website",
      });
      if (visit) await sendVisitNotice(visit.id, "requested", null);
    }

    if (conversation) {
      await notifyStaffOfFamilyMessage({
        conversationId: conversation.id,
        fromName: `${name ?? "New booking"} · ${CATEGORY_LABEL[categoryFor(input.type)]}`,
        body: `${input.label}${input.sameDay ? " (same day)" : ""}${input.postcode ? ` · ${input.postcode}` : ""}`,
      });
    }
    return true;
  } catch (err) {
    console.error("recordEnquiry failed", err);
    return false;
  }
}

/** The jobs list, newest first; optionally one category or status. */
export async function listEnquiries(filter: { category?: EnquiryCategory; status?: EnquiryStatus } = {}): Promise<Enquiry[]> {
  const admin = createAdminClient();
  let query = admin.from("enquiries").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.status) query = query.eq("status", filter.status);
  const { data } = await query;
  return ((data ?? []) as Row[]).map(mapEnquiry);
}

/** A customer's bookings, for the top of their conversation. */
export async function enquiriesForConversation(conversationId: string): Promise<Enquiry[]> {
  const { data } = await createAdminClient()
    .from("enquiries")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map(mapEnquiry);
}

/** Open jobs by conversation, for the tag on each inbox row. */
export async function openEnquiryCategories(): Promise<Map<string, EnquiryCategory>> {
  const { data } = await createAdminClient()
    .from("enquiries")
    .select("conversation_id, category")
    .in("status", ["new", "contacted", "booked"])
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: true });
  const map = new Map<string, EnquiryCategory>();
  for (const r of (data ?? []) as { conversation_id: string; category: EnquiryCategory }[]) map.set(r.conversation_id, r.category);
  return map;
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus, staffId: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("enquiries")
    .update({ status, updated_at: new Date().toISOString(), updated_by: staffId })
    .eq("id", id);
  if (error) console.error("setEnquiryStatus failed", error);
  return !error;
}

export async function getEnquiry(id: string): Promise<Enquiry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("enquiries").select("*").eq("id", id).maybeSingle();
  return data ? mapEnquiry(data as Row) : null;
}

/** A customer's bookings, newest first. */
export async function enquiriesForCustomer(customerId: string): Promise<Enquiry[]> {
  const { data } = await createAdminClient()
    .from("enquiries")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map(mapEnquiry);
}

/** The schedule's usual visit for each kind of booking. */
export function visitKindFor(category: EnquiryCategory): "callout" | "quote" | "service" | "other" {
  switch (category) {
    case "callout":
      return "callout";
    case "new_boiler":
      return "quote";
    case "service":
    case "plan":
      return "service";
    default:
      return "other";
  }
}

/** A booking form by its private link, for the customer's pick-a-time page. */
export async function getEnquiryByToken(token: string): Promise<Enquiry | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("enquiries").select("*").eq("public_token", token).maybeSingle();
  return data ? mapEnquiry(data as Row) : null;
}

/** Open booking forms (new or contacted) from the last `days` days, oldest first. */
export async function openEnquiriesSince(days: number): Promise<Enquiry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await createAdminClient()
    .from("enquiries")
    .select("*")
    .in("status", ["new", "contacted"])
    .gte("created_at", since)
    .order("created_at")
    .limit(500);
  return ((data ?? []) as Row[]).map(mapEnquiry);
}

/** What they told us, in a few words: "No heating or hot water". */
export function issueLine(e: Pick<Enquiry, "answers" | "message">, max = 70): string | null {
  const first = e.answers.find((a) => a.q !== "Postcode" && a.q !== "Best time")?.a ?? e.message ?? "";
  const one = first.replace(/\s+/g, " ").trim();
  if (!one) return null;
  return one.length > max ? `${one.slice(0, max - 3).trimEnd()}...` : one;
}
