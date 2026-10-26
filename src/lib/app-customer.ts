import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDisplayName } from "@/lib/display-name";
import { findOrCreateCustomer, getCustomer, listCustomerNotes } from "@/lib/customers";
import { appointmentsForCustomer } from "@/lib/appointments";
import { KIND_LABEL, STATUS_LABEL, addDays, longDate, windowLabel } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { getConversationForCoachById, getConversationMemberEmail, isGuestUser } from "@/lib/chat-db";
import { formatPence, partPaymentsFor, paymentsForCustomer, paymentsOn, savedCardFor } from "@/lib/payments";
import { planFor } from "@/lib/maintenance-plan";
import { QUOTE_STATUS_LABEL, quoteNumber, quotesForCustomer } from "@/lib/quotes";
import { toJobPayment, type JobPayment } from "@/lib/app-jobs";
import { customerPlan } from "@/lib/app-business";

/**
 * A customer for the team, in the app (mobile/app/customer/[id].tsx),
 * opened from their name at the top of a chat: everything in one place.
 * Their details and boiler, the team's private notes, jobs underway (each
 * opens its job page), what they owe (taken from here), open quotes, and
 * what's been done before, their maintenance plan, and their photos and
 * certificates (lib/app-business.ts).
 */

export type CustomerVisit = { id: string; when: string; kind: string; title: string | null; status: string; report: string | null };

export type StaffCustomer = {
  id: string;
  name: string;
  since: string;
  conversationId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  plan: string | null;
  /** Their maintenance plan, and what can be done with it. */
  planCard: Awaited<ReturnType<typeof customerPlan>>;
  boiler: { label: string; value: string }[];
  accessNotes: string | null;
  notes: { id: string; body: string; when: string; author: string | null }[];
  ongoing: CustomerVisit[];
  previous: CustomerVisit[];
  quotes: { id: string; number: string; title: string; total: string; status: string }[];
  payments: {
    on: boolean;
    terminalLocation: string | null;
    savedCard: { brand: string; last4: string } | null;
    open: JobPayment[];
    paidCount: number;
  };
  /** Everything the edit form changes, as saved. */
  fields: Record<string, string>;
};

const SHORT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long", year: "numeric" });

function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return longDate(day);
}

export async function staffCustomer(id: string, viewerId: string): Promise<StaffCustomer | null> {
  const customer = await getCustomer(id);
  if (!customer) return null;
  const [notes, visits, payments, plan, quotes, planCard] = await Promise.all([
    listCustomerNotes(id),
    appointmentsForCustomer(id),
    paymentsForCustomer(id),
    planFor(id).catch(() => null),
    quotesForCustomer(id).catch(() => []),
    customerPlan(id),
  ]);
  const open = payments.filter((p) => p.status === "open");
  const [parts, card] = await Promise.all([partPaymentsFor(open.map((p) => p.id)), paymentsOn() ? savedCardFor(customer) : Promise.resolve(null)]);
  const today = londonNow().dateISO;
  const visitDays = new Map(visits.map((v) => [v.id, v.day]));

  // Who wrote each note (not "you").
  const admin = createAdminClient();
  const authors = new Map<string, string>();
  await Promise.all(
    [...new Set(notes.map((n) => n.authorId).filter((a): a is string => !!a && a !== viewerId))].map(async (authorId) => {
      const { data } = await admin.auth.admin.getUserById(authorId);
      if (data?.user) authors.set(authorId, resolveDisplayName(data.user));
    }),
  );

  const shape = (v: (typeof visits)[number]): CustomerVisit => ({
    id: v.id,
    when: `${dayLabel(v.day, today)}, ${windowLabel(v.start, v.end)}`,
    kind: KIND_LABEL[v.kind],
    title: v.title,
    status: STATUS_LABEL[v.status],
    report: v.jobReport,
  });
  // Underway: anything booked from today on, asked for, or not in (to rebook). Soonest first.
  const ongoing = visits
    .filter((v) => (v.status === "booked" && v.day >= today) || v.status === "requested" || (v.status === "no_access" && v.day >= addDays(today, -14)))
    .sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
  const previous = visits.filter((v) => v.status === "done" || (v.status === "booked" && v.day < today)).slice(0, 12);

  const boiler = [
    ["Boiler", [customer.boilerMake, customer.boilerModel].filter(Boolean).join(" ")],
    ["Age", customer.boilerAge],
    ["Where it is", customer.boilerLocation],
    ["Last service", customer.lastService],
    ["Notes", customer.boilerNotes],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label: label as string, value: value as string }));

  const onPlan = plan && (plan.status === "active" || plan.status === "past_due") ? plan : null;
  return {
    id: customer.id,
    name: customer.name || customer.email || customer.phone || "Customer",
    since: `Customer since ${SHORT.format(new Date(customer.createdAt))}`,
    conversationId: customer.conversationId,
    email: customer.email,
    phone: customer.phone ?? customer.phoneE164,
    address: customer.address,
    postcode: customer.postcode,
    plan: onPlan ? (onPlan.status === "past_due" ? "Maintenance plan: last payment failed" : "On the maintenance plan") : null,
    planCard,
    boiler,
    accessNotes: customer.accessNotes,
    notes: notes.slice(0, 6).map((n) => ({
      id: n.id,
      body: n.body,
      when: longDate(n.createdAt.slice(0, 10)),
      author: n.authorId === viewerId ? "You" : n.authorId ? (authors.get(n.authorId) ?? null) : null,
    })),
    ongoing: ongoing.map(shape),
    previous: previous.map(shape),
    quotes: quotes
      .filter((q) => q.status === "sent" || q.status === "accepted")
      .slice(0, 5)
      .map((q) => ({ id: q.id, number: quoteNumber(q.number), title: q.title, total: formatPence(q.totalPence), status: QUOTE_STATUS_LABEL[q.status] })),
    payments: {
      on: paymentsOn(),
      terminalLocation: process.env.STRIPE_TERMINAL_LOCATION || null,
      savedCard: card ? { brand: card.brand, last4: card.last4 } : null,
      open: open.map((p) =>
        toJobPayment(
          p,
          (parts.get(p.id) ?? []).reduce((sum, x) => sum + x.amountPence, 0),
          p.appointmentId ? (visitDays.has(p.appointmentId) ? longDate(visitDays.get(p.appointmentId)!) : "another visit") : "none",
        ),
      ),
      paidCount: payments.filter((p) => p.status === "paid").length,
    },
    fields: {
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      postcode: customer.postcode ?? "",
      boilerMake: customer.boilerMake ?? "",
      boilerModel: customer.boilerModel ?? "",
      boilerAge: customer.boilerAge ?? "",
      boilerLocation: customer.boilerLocation ?? "",
      lastService: customer.lastService ?? "",
      boilerNotes: customer.boilerNotes ?? "",
      accessNotes: customer.accessNotes ?? "",
    },
  };
}

/** The customer a conversation belongs to: the one linked to it, else the signed-in customer's own record. */
export async function customerIdForConversation(conversationId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: linked } = await admin.from("customers").select("id").eq("conversation_id", conversationId).limit(1).maybeSingle();
  if (linked) return linked.id as string;
  const conversation = await getConversationForCoachById(conversationId);
  if (!conversation || conversation.isTeam) return null;
  const { data: byUser } = await admin.from("customers").select("id").eq("user_id", conversation.userId).limit(1).maybeSingle();
  return (byUser?.id as string | undefined) ?? null;
}

/**
 * Someone chatting who isn't a customer yet (a website visitor, say): a
 * customer record from what the chat knows (their name, email and
 * number), linked to the conversation. Needs an email or a number.
 */
export async function customerFromChat(conversationId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const existing = await customerIdForConversation(conversationId);
  if (existing) return { ok: true, id: existing };
  const conversation = await getConversationForCoachById(conversationId);
  if (!conversation || conversation.isTeam) return { ok: false, error: "That conversation has gone." };
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(conversation.userId);
  const guest = isGuestUser(data?.user);
  const name = guest ? conversation.guestName : resolveDisplayName(data?.user, "");
  const email = await getConversationMemberEmail(conversation);
  const id = await findOrCreateCustomer(admin, { name: name || null, email, phone: conversation.phone, conversationId });
  if (!id) return { ok: false, error: "There's no email or number for them yet. Ask for one in the chat, then try again." };
  // Theirs, if they're signed in, so their account and jobs line up.
  if (!guest && data?.user) await admin.from("customers").update({ user_id: data.user.id }).eq("id", id).is("user_id", null);
  return { ok: true, id };
}
