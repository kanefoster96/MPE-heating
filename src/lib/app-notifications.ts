import type { User } from "@supabase/supabase-js";
import { planMembersAmong } from "@/lib/maintenance-plan";
import { CLUB_SITE_URL } from "@/lib/club";
import { customerForUser, getCustomer } from "@/lib/customers";
import { appointmentsForCustomer, returnsToBook, waitingOnTeam } from "@/lib/appointments";
import { KIND_LABEL } from "@/lib/day-plan";
import { requestedWhen, whenLine } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { formatPence, invoiceNumber, payLink, paymentsForCustomer } from "@/lib/payments";
import { quoteLink, quoteNumber, quoteOpen, quotesForCustomer } from "@/lib/quotes";
import { planFor } from "@/lib/maintenance-plan";
import { filesForCustomer } from "@/lib/job-files";
import { CATEGORY_LABEL, listEnquiries } from "@/lib/enquiries";

/**
 * The app's bell (mobile/app/notifications.tsx): what's waiting, built
 * fresh from the records rather than stored. For a customer, things to do
 * (an invoice to pay, a quote to look at, a plan payment that failed) and
 * what's coming up (visits, a certificate running out). For the team, the
 * requests waiting on them: new bookings, visits asked for, and customers
 * asking to move a visit. `action` items count towards the badge.
 *
 * Each item opens a website page (`url`, in the app's in-app browser) or a
 * screen in the app (`route`).
 */

export type AppNotice = {
  id: string;
  icon: "card" | "document-text" | "calendar" | "shield-checkmark" | "time" | "construct" | "chatbubbles";
  title: string;
  text: string;
  at: string;
  action: boolean;
  url?: string;
  route?: string;
};

const SITE = CLUB_SITE_URL.replace(/\/$/, "");

export async function noticesFor(user: User, staff: boolean): Promise<AppNotice[]> {
  return staff ? staffNotices() : customerNotices(user);
}

async function customerNotices(user: User): Promise<AppNotice[]> {
  if (user.is_anonymous) return [];
  const customer = await customerForUser(user.id, user.email);
  if (!customer) return [];
  const today = londonNow().dateISO;
  const [visits, payments, quotes, plan, files] = await Promise.all([
    appointmentsForCustomer(customer.id),
    paymentsForCustomer(customer.id),
    quotesForCustomer(customer.id),
    planFor(customer.id),
    filesForCustomer(customer.id, { sharedOnly: true }).catch(() => []),
  ]);
  const out: AppNotice[] = [];

  for (const p of payments) {
    if (p.status !== "open") continue;
    if (p.planStatus === "past_due") {
      out.push({ id: `pay-${p.id}`, icon: "card", title: "A monthly payment didn't go through", text: `${invoiceNumber(p.number)}: please check your card.`, at: p.createdAt, action: true, url: payLink(p) });
    } else if (p.planStatus !== "active") {
      out.push({ id: `pay-${p.id}`, icon: "card", title: `${formatPence(p.amountPence)} to pay`, text: p.kind === "callout_fee" ? "Your call-out fee. It comes off your repair bill if you go ahead." : `${invoiceNumber(p.number)}: ${p.description}`, at: p.createdAt, action: true, url: payLink(p) });
    }
  }
  for (const q of quotes) {
    if (!quoteOpen(q)) continue;
    out.push({ id: `quote-${q.id}`, icon: "document-text", title: `Your quote: ${formatPence(q.totalPence)}`, text: `${quoteNumber(q.number)}: ${q.title}`, at: q.sentAt ?? q.createdAt, action: true, url: quoteLink(q) });
  }
  if (plan?.status === "past_due") {
    out.push({ id: `plan-${plan.id}`, icon: "shield-checkmark", title: "Your plan payment didn't go through", text: "Update your card to stay covered.", at: plan.paymentFailedAt ?? plan.startedAt ?? new Date().toISOString(), action: true, url: `${SITE}/plan/${plan.publicToken}` });
  }
  // Not fixed first time, and the return visit isn't booked yet: they know we're coming back.
  const followed = new Set(visits.filter((v) => v.followUpOf && v.status !== "cancelled").map((v) => v.followUpOf));
  for (const v of visits) {
    if (v.status !== "done" || v.outcome !== "return" || followed.has(v.id)) continue;
    out.push({
      id: `return-${v.id}`,
      icon: "construct",
      title: "We're coming back",
      text: `${v.returnNote ? `To ${v.returnNote.replace(/\.$/, "")}. ` : ""}We'll be in touch to book a time.`,
      at: v.completedAt ?? v.createdAt,
      action: false,
      url: `${SITE}/visit/${v.publicToken}`,
    });
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  for (const v of visits) {
    // A request whose day went by unbooked: pick another day.
    if (v.status === "requested" && v.day < today && v.day >= weekAgo) {
      out.push({ id: `visit-${v.id}`, icon: "time", title: "Pick another day", text: `Sorry, we didn't get to your ${KIND_LABEL[v.kind].toLowerCase()} on ${requestedWhen(v.day, v.part)}.`, at: v.createdAt, action: true, url: `${SITE}/visit/${v.publicToken}#another-time` });
      continue;
    }
    if (v.day < today) continue;
    if (v.status === "booked") {
      out.push({ id: `visit-${v.id}`, icon: "calendar", title: `${v.followUpOf ? "Return visit" : KIND_LABEL[v.kind]} booked`, text: whenLine(v), at: v.createdAt, action: false, url: `${SITE}/visit/${v.publicToken}` });
    } else if (v.status === "requested") {
      out.push({ id: `visit-${v.id}`, icon: "time", title: `${KIND_LABEL[v.kind]} requested`, text: `You asked for ${requestedWhen(v.day, v.part)}. We'll confirm the time.`, at: v.createdAt, action: false, url: `${SITE}/visit/${v.publicToken}` });
    }
  }
  const soon = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
  for (const f of files) {
    if (f.kind !== "certificate" || !f.expiresOn || f.expiresOn < today || f.expiresOn > soon) continue;
    out.push({ id: `cert-${f.id}`, icon: "shield-checkmark", title: `${f.title ?? "Certificate"} due for renewal`, text: `It runs out on ${f.expiresOn.split("-").reverse().join("/")}.`, at: f.createdAt, action: false, url: `${SITE}/account#files` });
  }
  return sortNotices(out);
}

async function staffNotices(): Promise<AppNotice[]> {
  const today = londonNow().dateISO;
  const [waiting, enquiries, returns] = await Promise.all([waitingOnTeam(today), listEnquiries({ status: "new" }).catch(() => []), returnsToBook().catch(() => [])]);
  const out: AppNotice[] = [];

  // On the maintenance plan: free call-out, said on their request so Fergal knows before he books.
  const members = await planMembersAmong([...waiting.map((v) => v.customerId), ...enquiries.map((e) => e.customerId)].filter((id): id is string => !!id)).catch(() => new Set<string>());
  const member = (id: string | null) => (id && members.has(id) ? " · Plan member" : "");
  const requested = new Set(waiting.filter((v) => v.status === "requested" && v.enquiryId).map((v) => v.enquiryId));
  for (const e of enquiries) {
    if (requested.has(e.id)) continue;
    out.push({
      id: `enquiry-${e.id}`,
      icon: "chatbubbles",
      title: `New booking: ${CATEGORY_LABEL[e.category]}${e.sameDay ? ", today" : ""}`,
      text: `${[e.name, e.postcode].filter(Boolean).join(", ") || "From the website"}${member(e.customerId)}`,
      at: e.createdAt,
      action: true,
      route: e.conversationId ? `/chat/${e.conversationId}` : "/chat",
    });
  }
  const names = new Map<string, string | null>();
  await Promise.all(
    [...new Set([...waiting, ...returns].map((v) => v.customerId).filter((id): id is string => !!id))].map(async (id) => names.set(id, (await getCustomer(id).catch(() => null))?.name ?? null)),
  );
  for (const v of waiting) {
    const who = (v.customerId && names.get(v.customerId)) || "A customer";
    // Answered on the visit's page in the app: accept, pick a time, or keep it.
    const route = `/job/${v.id}`;
    if (v.status === "requested") {
      out.push({ id: `request-${v.id}`, icon: "time", title: `${who} asked for a ${KIND_LABEL[v.kind].toLowerCase()}`, text: `${requestedWhen(v.day, v.part)}${member(v.customerId)}`, at: v.createdAt, action: true, route });
    } else if (v.change) {
      out.push({ id: `change-${v.id}`, icon: "calendar", title: `${who} asked to move their visit`, text: `To ${requestedWhen(v.change.day, v.change.part)}${v.change.note ? `: "${v.change.note}"` : ""}`, at: v.change.at, action: true, route });
    }
  }
  // Not fixed first time: the return visit still to book.
  for (const v of returns) {
    const who = (v.customerId && names.get(v.customerId)) || "A customer";
    out.push({
      id: `return-${v.id}`,
      icon: "construct",
      title: `Book ${who}'s return visit`,
      text: v.returnNote ? `To ${v.returnNote.replace(/\.$/, "")}` : "To finish the job",
      at: v.completedAt ?? v.createdAt,
      action: true,
      route: `/visit-form?followUp=${v.id}`,
    });
  }
  return sortNotices(out);
}

/** Things to do first, then newest first. */
function sortNotices(list: AppNotice[]): AppNotice[] {
  return list.sort((a, b) => Number(b.action) - Number(a.action) || b.at.localeCompare(a.at));
}
