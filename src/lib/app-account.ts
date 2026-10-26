import type { User } from "@supabase/supabase-js";
import { CLUB_SITE_URL } from "@/lib/club";
import { customerFieldsFromForm, customerForUser, updateCustomer, type Customer } from "@/lib/customers";
import { createRequest } from "@/lib/appointments";
import { isDayOff } from "@/lib/days-off";
import { KIND_LABEL, PARTS, PART_LABEL, REQUESTABLE_KINDS, addDays, isISODate, isPart, longDate, type AppointmentKind } from "@/lib/day-plan";
import { requestedWhen } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { postCustomerVisitMessage, sendVisitNotice } from "@/lib/visit-notify";
import { formatPence, invoiceNumber, paymentsForCustomer, paymentsOn } from "@/lib/payments";
import { instalmentProgress } from "@/lib/instalments";
import { BILLING_LABEL, PLAN_BENEFITS, billingPortalUrl, cancelPlan, earliestEnd, getPlanMember, keepPlan, minTermLine, pendingPlanFor, planDate, planFor, planOpen, planPrices, priceLine } from "@/lib/maintenance-plan";
import { addCardUrl, cardsFor, planPaymentsFor, removeCard } from "@/lib/customer-cards";
import { quoteNumber, quoteOpen, quotesForCustomer } from "@/lib/quotes";
import { fileLabel, filesForCustomer } from "@/lib/job-files";
import { availableCredits, referralCodeFor, referralLink, referralRewards, referralStats } from "@/lib/referrals";
import { jsonAsForm } from "@/lib/mobile-api";

/**
 * A customer's own account, for the app's Account screens (the website's
 * /account, section by section): payments and receipts, quotes,
 * certificates and photos, their maintenance plan, saved cards, their
 * details and boiler, asking for a visit, and their referral link. The
 * same functions as the website, so the rules and messages match. Paying,
 * accepting a quote, joining the plan and anything Stripe asks for open
 * the website's own page in the app, so Apple Pay and Stripe work as on the
 * web.
 */

const SITE = CLUB_SITE_URL.replace(/\/$/, "");
const pounds = (p: number) => `£${Number.isInteger(p / 100) ? p / 100 : (p / 100).toFixed(2)}`;

export async function myAccount(user: User) {
  const customer = user.is_anonymous ? null : await customerForUser(user.id, user.email);
  const today = londonNow().dateISO;
  if (!customer) return { customer: false as const, today };

  const payments = (await paymentsForCustomer(customer.id)).filter((x) => x.status !== "cancelled");
  const [plan, prices, progress, cards, planPayments, quotes, files, rewards] = await Promise.all([
    planFor(customer.id).catch(() => null),
    planPrices(),
    instalmentProgress(payments),
    cardsFor(customer.id).catch(() => []),
    planPaymentsFor(customer.id).catch(() => []),
    quotesForCustomer(customer.id).then((list) => list.filter((q) => q.status !== "cancelled")).catch(() => []),
    filesForCustomer(customer.id, { sharedOnly: true }).catch(() => []),
    referralRewards(),
  ]);
  const [refCode, refStats, credits] = rewards ? await Promise.all([referralCodeFor(customer.id), referralStats(customer.id), availableCredits(customer.id)]) : [null, null, []];
  const onPlan = plan && (plan.status === "active" || plan.status === "past_due") ? plan : null;
  const end = onPlan ? earliestEnd(onPlan) : null;

  return {
    customer: true as const,
    today,
    name: customer.name,
    payments: payments.map((p) => ({
      id: p.id,
      title: p.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(p.number)}`,
      detail: p.kind === "callout_fee" ? "Comes off your repair if you go ahead" : p.description,
      monthly:
        p.status === "open" && p.planStatus
          ? `Paying monthly: ${formatPence(progress.get(p.id)?.balancePence ?? p.amountPence)} left${p.planStatus === "past_due" ? ", last payment failed" : ""}`
          : null,
      failed: p.planStatus === "past_due",
      amount: formatPence(p.amountPence),
      status: p.status === "paid" ? "Paid" : p.planStatus ? "Monthly" : "Pay now",
      paid: p.status === "paid",
      url: `${SITE}/pay/${p.publicToken}`,
    })),
    paysMonthly: payments.some((p) => p.planStatus === "active" || p.planStatus === "past_due"),
    planPayments: planPayments.map((pp) => ({ id: pp.id, when: longDate(pp.date.slice(0, 10)), amount: formatPence(pp.amountPence), status: pp.status, url: pp.url })),
    quotes: quotes.map((q) => ({
      id: q.id,
      title: `Quote ${quoteNumber(q.number)}`,
      detail: q.title,
      amount: formatPence(q.totalPence),
      status: q.status === "accepted" ? "Accepted" : quoteOpen(q) ? "Open: see and accept" : q.status === "declined" ? "Declined" : "Ran out",
      tone: q.status === "accepted" ? "good" : quoteOpen(q) ? "open" : "plain",
      url: `${SITE}/quote/${q.publicToken}`,
    })),
    certificates: files
      .filter((f) => f.kind === "certificate")
      .map((f) => ({
        id: f.id,
        label: fileLabel(f),
        detail: [f.issuedOn ? `Issued ${longDate(f.issuedOn)}` : "", f.expiresOn ? `Runs out ${longDate(f.expiresOn)}` : ""].filter(Boolean).join(" · "),
        url: f.url,
      })),
    photos: files.filter((f) => f.kind === "photo").map((f) => ({ id: f.id, label: fileLabel(f), url: f.url })),
    plan: onPlan
      ? {
          on: true as const,
          benefits: PLAN_BENEFITS,
          status: onPlan.status === "past_due" ? "Payment failed" : onPlan.cancelAt ? `Ends ${planDate(onPlan.cancelAt)}` : "Active",
          tone: onPlan.status === "past_due" ? "bad" : onPlan.cancelAt ? "plain" : "good",
          line: [
            `${onPlan.pricePence && onPlan.billing ? `${formatPence(onPlan.pricePence)} ${BILLING_LABEL[onPlan.billing]}` : "On the plan"}${onPlan.startedAt ? `, since ${planDate(onPlan.startedAt)}` : ""}.`,
            !onPlan.cancelAt && onPlan.currentPeriodEnd ? `Next payment ${planDate(onPlan.currentPeriodEnd)}.` : "",
            onPlan.lastServiceOn ? `Last service ${longDate(onPlan.lastServiceOn)}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          failed: onPlan.status === "past_due",
          leaving: !!onPlan.cancelAt,
          cancelNote: `${end ? `It'll end on ${planDate(end.toISOString())}, and you're covered until then.` : "It'll end at the end of what you've paid for."}${onPlan.minMonths > 0 ? ` ${minTermLine(onPlan.minMonths)}` : ""}`,
        }
      : planOpen(prices)
        ? { on: false as const, benefits: PLAN_BENEFITS, line: `${priceLine(prices)}. ${minTermLine(prices.minMonths)}`.trim() }
        : null,
    cardsOn: paymentsOn(),
    cards: cards.map((c) => ({ id: c.id, label: `${c.brand} ending ${c.last4}`, detail: `${c.expired ? "Expired" : "Expires"} ${c.expires}${c.usedFor.length ? ` · ${c.usedFor.join(", ")}` : ""}`, expired: c.expired, removable: c.usedFor.length === 0 })),
    refer:
      rewards && refCode
        ? {
            link: referralLink(refCode),
            line: `Know someone who needs a heating engineer? Share your link.${rewards.friendPence ? ` They get ${pounds(rewards.friendPence)} off their first job.` : ""}${rewards.referrerPence ? ` Once they've had it, you get ${pounds(rewards.referrerPence)} off your next.` : ""}`,
            share: `I use MPE for my boiler. Book through this link${rewards.friendPence ? ` and get ${pounds(rewards.friendPence)} off your first job` : ""}:`,
            referred: refStats?.referred ?? 0,
            credit: credits.length ? `${pounds(credits.reduce((sum, c) => sum + c.amountPence, 0))} off your next job: it comes off your next invoice.` : null,
          }
        : null,
    request: { kinds: REQUESTABLE_KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] })), parts: PARTS.map((p) => ({ key: p, label: PART_LABEL[p] })), last: addDays(today, 60) },
    fields: fieldsOf(customer),
  };
}

function fieldsOf(c: Customer): Record<string, string> {
  return {
    name: c.name ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    postcode: c.postcode ?? "",
    boilerMake: c.boilerMake ?? "",
    boilerModel: c.boilerModel ?? "",
    boilerAge: c.boilerAge ?? "",
    boilerLocation: c.boilerLocation ?? "",
    lastService: c.lastService ?? "",
    boilerNotes: c.boilerNotes ?? "",
    accessNotes: c.accessNotes ?? "",
  };
}

type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };

/** What a customer does from the app's Account screens: the website's account actions. */
export async function myAccountAction(user: User, body: Record<string, unknown>): Promise<Result> {
  if (user.is_anonymous) return { ok: false, error: "Sign in first." };
  const customer = await customerForUser(user.id, user.email);
  if (!customer) return { ok: false, error: "We can't find your account. Message us and we'll sort it." };
  const action = String(body.action ?? "");

  if (action === "details") {
    // Their email is their login, so it isn't changed here.
    const fields = { ...body };
    delete fields.email;
    delete fields.action;
    const parsed = customerFieldsFromForm(jsonAsForm(fields));
    if (!parsed.ok) return parsed;
    const result = await updateCustomer(customer.id, parsed.fields);
    if (!result.ok) return { ok: false, error: result.error.startsWith("Another customer") ? "That number is already on another account. Message us and we'll sort it." : result.error };
    return { ok: true, message: "Saved. Thanks!" };
  }

  if (action === "request") {
    const kind = String(body.kind ?? "") as AppointmentKind;
    const day = String(body.day ?? "");
    const part = String(body.part ?? "");
    const note = String(body.note ?? "").trim().slice(0, 500) || null;
    const today = londonNow().dateISO;
    if (!(REQUESTABLE_KINDS as readonly string[]).includes(kind) || !isISODate(day) || day < today || day > addDays(today, 60) || !isPart(part)) {
      return { ok: false, error: "Pick what you need, a day and a time of day." };
    }
    if (await isDayOff(day)) return { ok: false, error: "We're not working that day. Please pick another." };
    const visit = await createRequest({ customerId: customer.id, kind, day, part, note, address: customer.address, postcode: customer.postcode, source: "account" });
    if (!visit) return { ok: false, error: "Couldn't send that just now. Please try again." };
    await postCustomerVisitMessage(customer, `I'd like to book a ${KIND_LABEL[kind].toLowerCase()} on ${requestedWhen(day, part)}${part === "any" ? ", any time" : ""}.${note ? `\n${note}` : ""}`);
    await sendVisitNotice(visit.id, "requested", null);
    return { ok: true, message: "Thanks, your request is in. We'll be in touch to confirm the time." };
  }

  if (action === "plan_join") {
    const member = await pendingPlanFor(customer.id, null);
    return member ? { ok: true, url: `${SITE}/plan/${member.publicToken}` } : { ok: false, error: "Couldn't do that just now. Please try again." };
  }

  if (action === "plan_billing") {
    const url = await billingPortalUrl(customer.id, "/account#plan");
    return url ? { ok: true, url } : { ok: false, error: "Couldn't open that just now. Please try again, or call us." };
  }

  if (action === "plan_cancel" || action === "plan_keep") {
    const member = await planFor(customer.id);
    const mine = member ? await getPlanMember(member.id) : null;
    if (!mine || mine.customerId !== customer.id) return { ok: false, error: "You're not on the plan." };
    if (action === "plan_keep") {
      const result = await keepPlan(mine.id);
      return result.ok ? { ok: true, message: "Great, your plan carries on." } : result;
    }
    const result = await cancelPlan(mine.id);
    if (!result.ok) return result;
    await postCustomerVisitMessage(customer, `I've cancelled my maintenance plan${result.endsOn ? `. It ends on ${planDate(result.endsOn)}` : ""}.`);
    return { ok: true, message: "Cancelled. You're covered until it ends." };
  }

  if (action === "card_add") {
    const url = await addCardUrl(customer.id, "/account#cards");
    return url ? { ok: true, url } : { ok: false, error: "Couldn't open that just now. Please try again." };
  }

  if (action === "card_remove") {
    const result = await removeCard(customer.id, String(body.id ?? ""));
    return result.ok ? { ok: true, message: "Card removed." } : result;
  }

  return { ok: false, error: "Nothing to do." };
}
