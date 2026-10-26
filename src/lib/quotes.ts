import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { getCustomer, type Customer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { chatRecipientIds } from "@/lib/chat-routing";
import { pushToUsers } from "@/lib/push";
import { londonNow } from "@/lib/schedule-time";
import { addDays, longDate } from "@/lib/day-plan";
import { calloutCreditFor, checkoutUrl, createPaymentRequest, formatPence, parseLines, paymentsOn, type PaymentLine } from "@/lib/payments";
import { getAppointment } from "@/lib/appointments";

/**
 * Quotes, mostly for new boilers (Kanvas One's "quotes they accept online,
 * with the deposit paid"). After the quote visit Fergal writes it: a line
 * per part and the labour, what's included, any deposit, and how long it's
 * open. It's sent by text, message, email and the app as a link to the
 * quote. The customer accepts it there, paying the deposit if there is one
 * (Stripe Checkout, through a payment request like any other), or says no
 * thanks. Either way the team gets a push.
 *
 * Open quotes are followed up twice (lib/follow-up-sweep.ts), then lapse
 * the day after they run out. When the work's done, "Invoice the rest"
 * sends the invoice with the deposit taken off, monthly if Fergal offered
 * that on the quote.
 */

export type QuoteStatus = "sent" | "accepted" | "declined" | "expired" | "cancelled";
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  sent: "Waiting for them",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Ran out",
  cancelled: "Withdrawn",
};

export type Quote = {
  id: string;
  number: number;
  customerId: string;
  appointmentId: string | null;
  title: string;
  lines: PaymentLine[];
  totalPence: number;
  depositPence: number;
  details: string | null;
  balanceInstalments: number | null;
  validUntil: string;
  status: QuoteStatus;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  depositRequestId: string | null;
  balanceRequestId: string | null;
  followupCount: number;
  publicToken: string;
  createdAt: string;
};

type Row = {
  id: string;
  number: number;
  customer_id: string;
  appointment_id: string | null;
  title: string;
  lines: { description: string; amount_pence: number }[] | null;
  total_pence: number;
  deposit_pence: number;
  details: string | null;
  balance_instalments: number | null;
  valid_until: string;
  status: QuoteStatus;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  deposit_request_id: string | null;
  balance_request_id: string | null;
  followup_count: number | null;
  public_token: string;
  created_at: string;
};

function mapRow(r: Row): Quote {
  return {
    id: r.id,
    number: r.number,
    customerId: r.customer_id,
    appointmentId: r.appointment_id,
    title: r.title,
    lines: (r.lines ?? []).map((l) => ({ description: l.description, amountPence: l.amount_pence })),
    totalPence: r.total_pence,
    depositPence: r.deposit_pence ?? 0,
    details: r.details,
    balanceInstalments: r.balance_instalments,
    validUntil: r.valid_until,
    status: r.status,
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    acceptedAt: r.accepted_at,
    declinedAt: r.declined_at,
    declineReason: r.decline_reason,
    depositRequestId: r.deposit_request_id,
    balanceRequestId: r.balance_request_id,
    followupCount: r.followup_count ?? 0,
    publicToken: r.public_token,
    createdAt: r.created_at,
  };
}

/** "Q-1001". */
export function quoteNumber(n: number): string {
  return `Q-${n}`;
}

export function quoteLink(q: Pick<Quote, "publicToken">): string {
  return `${CLUB_SITE_URL.replace(/\/$/, "")}/quote/${q.publicToken}`;
}

/** Open, and still in date: it can be accepted. */
export function quoteOpen(q: Pick<Quote, "status" | "validUntil">): boolean {
  return q.status === "sent" && q.validUntil >= londonNow().dateISO;
}

export const DEFAULT_VALID_DAYS = 30;
const UUID = /^[0-9a-f-]{36}$/i;

// ---------------------------------------------------------------------------
// Reading.

export async function getQuote(id: string): Promise<Quote | null> {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("quotes").select("*").eq("id", id).maybeSingle();
  return data ? mapRow(data as Row) : null;
}

export async function getQuoteByToken(token: string): Promise<Quote | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("quotes").select("*").eq("public_token", token).maybeSingle();
  return data ? mapRow(data as Row) : null;
}

export async function quotesForCustomer(customerId: string): Promise<Quote[]> {
  const { data } = await createAdminClient().from("quotes").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50);
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function quotesForAppointments(ids: string[]): Promise<Map<string, Quote[]>> {
  const map = new Map<string, Quote[]>();
  if (!ids.length) return map;
  const { data } = await createAdminClient().from("quotes").select("*").in("appointment_id", [...new Set(ids)]).neq("status", "cancelled");
  for (const q of ((data ?? []) as Row[]).map(mapRow)) map.set(q.appointmentId!, [...(map.get(q.appointmentId!) ?? []), q]);
  return map;
}

/** The team's list: open ones, accepted ones not yet invoiced, and the rest from the last 90 days. */
export async function listQuotes(show: "open" | "accepted" | "closed"): Promise<Quote[]> {
  const admin = createAdminClient();
  let query = admin.from("quotes").select("*").order("created_at", { ascending: false }).limit(300);
  if (show === "open") query = query.eq("status", "sent");
  if (show === "accepted") query = query.eq("status", "accepted").is("balance_request_id", null);
  if (show === "closed") query = query.in("status", ["accepted", "declined", "expired", "cancelled"]).gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  const { data } = await query;
  return ((data ?? []) as Row[]).map(mapRow);
}

/** First time the customer opens it: the team can see it's been looked at. */
export async function markQuoteViewed(id: string): Promise<void> {
  await createAdminClient().from("quotes").update({ viewed_at: new Date().toISOString() }).eq("id", id).is("viewed_at", null);
}

// ---------------------------------------------------------------------------
// Writing and sending.

export async function createQuote(params: {
  staffId: string;
  customerId: string;
  appointmentId?: string | null;
  title: string;
  lines: unknown;
  depositPence: number;
  details?: string | null;
  validDays?: number;
  balanceInstalments?: number | null;
}): Promise<{ ok: true; quote: Quote; sentVia: string[] } | { ok: false; error: string }> {
  const customer = await getCustomer(params.customerId);
  if (!customer) return { ok: false, error: "Customer not found." };
  const parsed = parseLines(params.lines);
  if (!parsed.ok) return parsed;
  const total = parsed.lines.reduce((sum, l) => sum + l.amountPence, 0);
  const deposit = Math.max(0, Math.round(params.depositPence || 0));
  if (deposit >= total) return { ok: false, error: "The deposit needs to be less than the total." };
  if (deposit > 0 && deposit < 100) return { ok: false, error: "A deposit needs to be at least £1, or leave it blank." };
  const days = Math.min(Math.max(Math.round(params.validDays ?? DEFAULT_VALID_DAYS), 1), 180);
  const instalments = params.balanceInstalments && params.balanceInstalments >= 2 && params.balanceInstalments <= 12 ? params.balanceInstalments : null;

  const { data, error } = await createAdminClient()
    .from("quotes")
    .insert({
      customer_id: customer.id,
      appointment_id: params.appointmentId ?? null,
      title: params.title.trim().replace(/\s+/g, " ").slice(0, 120) || "Your quote",
      lines: parsed.lines.map((l) => ({ description: l.description, amount_pence: l.amountPence })),
      total_pence: total,
      deposit_pence: deposit,
      details: params.details?.trim().slice(0, 2000) || null,
      balance_instalments: instalments,
      valid_until: addDays(londonNow().dateISO, days),
      created_by: params.staffId,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("quotes: create failed", error);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  const quote = mapRow(data as Row);
  const sentVia = await sendQuote(quote, customer, params.staffId);
  return { ok: true, quote, sentVia };
}

const hi = (c: Pick<Customer, "name">) => (c.name ? `Hi ${c.name.split(" ")[0]}, ` : "Hi, ");
const lower = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a"';
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function quoteEmail(params: { name: string | null; heading: string; paragraphs: string[]; cta: { label: string; url: string } }): string {
  return renderEmailLayout({
    previewText: params.paragraphs[0].slice(0, 100),
    heading: params.heading,
    bodyHtml: `<p ${P}>${params.name ? `Hi ${esc(params.name.split(" ")[0])},` : "Hi,"}</p>${params.paragraphs.map((p) => `<p ${P}>${esc(p)}</p>`).join("")}`,
    ctaLabel: params.cta.label,
    ctaUrl: params.cta.url,
    secondaryCtaLabel: `Call ${business.phoneDisplay}`,
    secondaryCtaUrl: business.phoneHref,
  });
}

/** The quote, by text, message, email and the app: what it's for, the price, the deposit, and the link. */
export async function sendQuote(quote: Quote, customer: Customer, staffId: string | null): Promise<string[]> {
  const link = quoteLink(quote);
  const deposit = quote.depositPence > 0 ? `, with a ${formatPence(quote.depositPence)} deposit to book in` : "";
  const body = `${hi(customer)}here's your quote ${quoteNumber(quote.number)} for ${lower(quote.title)}: ${formatPence(quote.totalPence)}${deposit}. See what's included and accept it here: ${link}`;
  const via = await deliverToCustomer(customer, {
    body,
    headline: `Your quote ${quoteNumber(quote.number)}`,
    staffId,
    pushHref: `/quote/${quote.publicToken}`,
    emailHtml: () =>
      quoteEmail({
        name: customer.name,
        heading: `Your quote for ${lower(quote.title)}`,
        paragraphs: [
          `Here's your quote ${quoteNumber(quote.number)}: ${formatPence(quote.totalPence)}${deposit}.`,
          `It's open until ${longDate(quote.validUntil)}. See what's included and accept it online. Any questions, just reply or call ${business.phoneDisplay}.`,
        ],
        cta: { label: "See your quote", url: link },
      }),
  });
  await createAdminClient().from("quotes").update({ sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", quote.id);
  return via;
}

/** "Send it again" from the team. */
export async function resendQuote(id: string, staffId: string): Promise<string[]> {
  const quote = await getQuote(id);
  const customer = quote ? await getCustomer(quote.customerId) : null;
  if (!quote || !customer || quote.status !== "sent") return [];
  return sendQuote(quote, customer, staffId);
}

export async function cancelQuote(id: string): Promise<boolean> {
  const { data } = await createAdminClient().from("quotes").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "sent").select("id");
  if (data?.length) await dropUnpaidDeposit(id);
  return !!data?.length;
}

/** A quote that's closed without being accepted: its deposit, if started and not paid, is cancelled. */
export async function dropUnpaidDeposit(quoteId: string): Promise<void> {
  await createAdminClient()
    .from("payment_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("quote_id", quoteId)
    .eq("kind", "other")
    .eq("status", "open");
}

// ---------------------------------------------------------------------------
// The customer's answer.

async function alertTeam(title: string, body: string, href: string): Promise<void> {
  try {
    await pushToUsers(await chatRecipientIds(), { title, body, data: { kind: "link", href } });
  } catch (err) {
    console.error("quotes: team alert failed", err);
  }
}

/** Accepted (with the deposit paid, if there was one): the team books the work in, and the customer's told what's next. */
async function markAccepted(quote: Quote, depositPaid: boolean): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", quote.id)
    .in("status", ["sent", "expired"])
    .select("id");
  if (!data?.length) return false;
  const customer = await getCustomer(quote.customerId);
  const who = customer?.name || customer?.email || "A customer";
  await alertTeam(
    "Quote accepted",
    `${who} accepted ${quoteNumber(quote.number)} (${formatPence(quote.totalPence)})${depositPaid ? ` and paid the ${formatPence(quote.depositPence)} deposit` : ""}. Book the work in.`,
    `/staff/customers/${quote.customerId}#quotes`,
  );
  if (customer) {
    const body = `${hi(customer)}thanks for accepting quote ${quoteNumber(quote.number)} for ${lower(quote.title)}${depositPaid ? `, and for the ${formatPence(quote.depositPence)} deposit` : ""}. We'll be in touch to book the date. Any questions, just reply.`;
    await deliverToCustomer(customer, {
      body,
      headline: "Quote accepted",
      staffId: null,
      pushHref: `/quote/${quote.publicToken}`,
      emailHtml: () =>
        quoteEmail({
          name: customer.name,
          heading: "Thanks for accepting your quote",
          paragraphs: [`Thanks for accepting quote ${quoteNumber(quote.number)} for ${lower(quote.title)}${depositPaid ? `, and for the ${formatPence(quote.depositPence)} deposit` : ""}.`, "We'll be in touch to book the date."],
          cta: { label: "See your quote", url: quoteLink(quote) },
        }),
    });
  }
  return true;
}

/** "Accept" on a quote with no deposit. */
export async function acceptQuote(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const quote = await getQuoteByToken(token);
  if (!quote) return { ok: false, error: "That quote isn't there any more." };
  if (!quoteOpen(quote)) return { ok: false, error: quote.status === "accepted" ? "You've already accepted this quote." : "This quote is no longer open. Ask us for an updated one." };
  if (quote.depositPence > 0) return { ok: false, error: "This quote needs its deposit to accept it." };
  await markAccepted(quote, false);
  return { ok: true };
}

/** "Accept and pay the deposit": its payment request (made once), then Stripe Checkout back to the quote. */
export async function depositCheckoutUrl(token: string): Promise<{ url: string } | { error: string }> {
  const quote = await getQuoteByToken(token);
  if (!quote) return { error: "That quote isn't there any more." };
  if (!quoteOpen(quote)) return { error: quote.status === "accepted" ? "You've already accepted this quote." : "This quote is no longer open. Ask us for an updated one." };
  if (quote.depositPence <= 0) return { error: "This quote has no deposit." };
  if (!paymentsOn()) return { error: `Paying online isn't switched on yet. Please call us on ${business.phoneDisplay}.` };
  let requestId = quote.depositRequestId;
  if (!requestId) {
    const created = await createPaymentRequest({
      staffId: null,
      customerId: quote.customerId,
      appointmentId: quote.appointmentId,
      kind: "other",
      description: `Deposit for quote ${quoteNumber(quote.number)}: ${quote.title}`,
      lines: [{ description: `Deposit for quote ${quoteNumber(quote.number)}`, amountPence: quote.depositPence }],
      send: false,
      quoteId: quote.id,
    });
    if (!created.ok) return { error: created.error };
    requestId = created.request.id;
    await createAdminClient().from("quotes").update({ deposit_request_id: requestId }).eq("id", quote.id).is("deposit_request_id", null);
  }
  return checkoutUrl(requestId, { saveCard: false, returnTo: quoteLink(quote) });
}

/** The deposit's paid (lib/payments.ts markPaid): the quote's accepted. */
export async function quoteDepositPaid(quoteId: string): Promise<void> {
  const quote = await getQuote(quoteId);
  if (!quote) return;
  if (!(await markAccepted(quote, true)) && quote.status !== "accepted") {
    await alertTeam("Deposit paid", `A deposit came in for ${quoteNumber(quote.number)}, which was ${quote.status}. Check whether it should be refunded.`, `/staff/customers/${quote.customerId}#quotes`);
  }
}

/** "No thanks", with an optional reason: the team's told, so Fergal can follow it up. */
export async function declineQuote(token: string, reason: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const quote = await getQuoteByToken(token);
  if (!quote || quote.status !== "sent") return { ok: false, error: "That quote is no longer open." };
  const why = reason?.trim().slice(0, 500) || null;
  await createAdminClient().from("quotes").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: why, updated_at: new Date().toISOString() }).eq("id", quote.id).eq("status", "sent");
  await dropUnpaidDeposit(quote.id);
  const customer = await getCustomer(quote.customerId);
  await alertTeam("Quote declined", `${customer?.name || "A customer"} said no to ${quoteNumber(quote.number)} (${formatPence(quote.totalPence)})${why ? `: "${why}"` : "."}`, `/staff/customers/${quote.customerId}#quotes`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// After the work: the invoice for the rest.

/** The invoice for what's left: the quote's lines, less the deposit paid, monthly if the quote offered it. */
export async function invoiceBalance(quoteId: string, staffId: string, opts: { appointmentId?: string | null } = {}): Promise<{ ok: true; sentVia: string[] } | { ok: false; error: string }> {
  const quote = await getQuote(quoteId);
  if (!quote || quote.status !== "accepted") return { ok: false, error: "Only an accepted quote can be invoiced." };
  if (quote.balanceRequestId) return { ok: false, error: "The invoice for this quote has already been sent." };
  let depositPaid = 0;
  if (quote.depositRequestId) {
    const { data } = await createAdminClient().from("payment_requests").select("status, amount_pence").eq("id", quote.depositRequestId).maybeSingle();
    if (data?.status === "paid") depositPaid = data.amount_pence as number;
  }
  // The call-out they paid for this job comes off, as the site says (the
  // repair's price was quoted after the call-out found the fault).
  const visitId = opts.appointmentId ?? quote.appointmentId;
  const visit = visitId ? await getAppointment(visitId) : null;
  const calloutPaid = await calloutCreditFor(visit ?? { id: null, followUpOf: null, customerId: quote.customerId });
  const lines = [
    ...quote.lines,
    ...(depositPaid ? [{ description: `Deposit paid (quote ${quoteNumber(quote.number)})`, amountPence: -depositPaid }] : []),
    ...(calloutPaid ? [{ description: "Call-out fee already paid", amountPence: -calloutPaid }] : []),
  ];
  const created = await createPaymentRequest({
    staffId,
    customerId: quote.customerId,
    appointmentId: opts.appointmentId ?? null,
    kind: "invoice",
    description: quote.title,
    lines,
    quoteId: quote.id,
    instalments: quote.balanceInstalments ? { months: quote.balanceInstalments, depositPence: 0 } : null,
  });
  if (!created.ok) return created;
  await createAdminClient().from("quotes").update({ balance_request_id: created.request.id, updated_at: new Date().toISOString() }).eq("id", quote.id);
  return { ok: true, sentVia: created.sentVia };
}

// ---------------------------------------------------------------------------
// Following up (lib/follow-up-sweep.ts).

/** Two days after sending, then six: a nudge, then the last word with the date it runs out. */
export async function sendQuoteFollowUp(id: string, stage: 1 | 2): Promise<boolean> {
  const quote = await getQuote(id);
  const customer = quote ? await getCustomer(quote.customerId) : null;
  if (!quote || !customer || !quoteOpen(quote)) return false;
  const link = quoteLink(quote);
  const body =
    stage === 1
      ? `${hi(customer)}just checking you got your quote for ${lower(quote.title)} (${formatPence(quote.totalPence)}). Any questions, just reply. You can accept it here: ${link}`
      : `${hi(customer)}your quote for ${lower(quote.title)} is open until ${longDate(quote.validUntil)}. Happy to talk it through: just reply or call ${business.phoneDisplay}. ${link}`;
  const via = await deliverToCustomer(customer, {
    body,
    headline: stage === 1 ? "Your quote" : "Your quote is still open",
    staffId: null,
    pushHref: `/quote/${quote.publicToken}`,
    smsOptOut: true,
    emailHtml: () =>
      quoteEmail({
        name: customer.name,
        heading: stage === 1 ? "Did you get your quote?" : "Your quote is still open",
        paragraphs: [
          stage === 1
            ? `Just checking you got your quote for ${lower(quote.title)} (${formatPence(quote.totalPence)}). Any questions, just reply.`
            : `Your quote for ${lower(quote.title)} is open until ${longDate(quote.validUntil)}. Happy to talk it through: just reply or call ${business.phoneDisplay}.`,
        ],
        cta: { label: "See your quote", url: link },
      }),
  });
  return via.length > 0;
}
