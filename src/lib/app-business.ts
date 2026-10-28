import { customerLabel, getCustomers, listCustomers } from "@/lib/customers";
import { forgetTeamHours, hoursLabel, teamHours } from "@/lib/team-hours";
import { monthUsage, poundsFromPence, ratesInPence } from "@/lib/twilio-usage";
import { formatPence } from "@/lib/payments";
import { longDate } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { appointmentsBetween } from "@/lib/appointments";
import { addDayOff, listDaysOff, removeDayOff } from "@/lib/days-off";
import { CERT_LABEL, CERT_TYPES, fileLabel, filesForCustomer } from "@/lib/job-files";
import {
  BILLING_LABEL,
  PLAN_BENEFITS,
  cancelPlan,
  earliestEnd,
  keepPlan,
  listPlanMembers,
  planDate,
  planFor,
  planOpen,
  planPrices,
  priceLine,
  sendPlanInvite,
  type PlanMember,
} from "@/lib/maintenance-plan";
import { MAX_UPSELLS, SUGGESTED_PRODUCTS, archiveProduct, createProduct, defaultUpsellPrice, listProducts, productFromForm, setUpsell, updateProduct } from "@/lib/products";
import { referralRewards } from "@/lib/referrals";
import { getSetting, parseReviewUrl, setSetting } from "@/lib/settings";
import { viaPhrase } from "@/lib/visit-notify";
import { jsonAsForm } from "@/lib/mobile-api";

/**
 * The rest of the website's team pages, for the app (so Fergal never needs
 * the website): every customer with a search, the maintenance plan's
 * members and each customer's plan, their photos and certificates, days
 * off, and Settings (plan prices, referral rewards, the Google review link,
 * products). Each uses the website's own functions, so the rules and the
 * messages are the same.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Customers.

export async function customerList(q: string) {
  const found = await listCustomers(q.trim() || undefined, 200);
  return found.map((c) => ({
    id: c.id,
    label: customerLabel(c),
    sub: [c.postcode, c.phone, c.name ? c.email : null].filter(Boolean).join(" · ") || "No details yet",
    boiler: [c.boilerMake, c.boilerModel].filter(Boolean).join(" ") || null,
  }));
}

// ---------------------------------------------------------------------------
// Maintenance plan.

function memberStatus(m: PlanMember): string {
  return m.status === "ended"
    ? `Ended${m.endedAt ? ` ${planDate(m.endedAt)}` : ""}`
    : m.status === "past_due"
      ? "Payment failed"
      : m.cancelAt
        ? `Ends ${planDate(m.cancelAt)}`
        : m.currentPeriodEnd
          ? `Next payment ${planDate(m.currentPeriodEnd)}`
          : "Active";
}

/** Everyone on the plan (the website's Plan members): what they pay, the next payment, failed payments, who's leaving. */
export async function planMembers() {
  const [members, prices] = await Promise.all([listPlanMembers(), planPrices()]);
  const customers = await getCustomers(members.map((m) => m.customerId));
  const live = members.filter((m) => m.status === "active" || m.status === "past_due");
  const ended = members.filter((m) => m.status === "ended");
  const monthly = live.reduce((sum, m) => sum + (m.pricePence ? (m.billing === "year" ? m.pricePence / 12 : m.pricePence) : 0), 0);
  const row = (m: PlanMember) => ({
    id: m.id,
    customerId: m.customerId,
    name: customerLabel(customers.get(m.customerId) ?? { name: null, email: null, phone: null }),
    detail: [
      m.pricePence && m.billing ? `${formatPence(m.pricePence)} ${BILLING_LABEL[m.billing]}` : "",
      m.startedAt ? `since ${planDate(m.startedAt)}` : "",
      m.lastServiceOn ? `serviced ${longDate(m.lastServiceOn)}` : "no service yet",
    ]
      .filter(Boolean)
      .join(" · "),
    status: memberStatus(m),
    tone: m.status === "past_due" ? "bad" : m.status === "ended" || m.cancelAt ? "plain" : "good",
  });
  return {
    prices: planOpen(prices) ? `${priceLine(prices)} for new members.` : "No price set, so no one can join online yet.",
    stats: { members: live.length, monthly: formatPence(Math.round(monthly)), failed: live.filter((m) => m.status === "past_due").length, leaving: live.filter((m) => m.cancelAt).length },
    live: live.map(row),
    ended: ended.map(row),
  };
}

/** A customer's plan, for their page in the app: where it's at and what can be done. */
export async function customerPlan(customerId: string) {
  const [plan, prices] = await Promise.all([planFor(customerId).catch(() => null), planPrices()]);
  const on = plan && (plan.status === "active" || plan.status === "past_due") ? plan : null;
  if (on) {
    const end = earliestEnd(on);
    return {
      on: true,
      line: [
        `${on.pricePence && on.billing ? `${formatPence(on.pricePence)} ${BILLING_LABEL[on.billing]}` : "On the plan"}${on.startedAt ? ` since ${planDate(on.startedAt)}` : ""}.`,
        on.status === "past_due" ? "Last payment failed: they've been sent a link to fix it." : on.cancelAt ? `Cancelled: ends ${planDate(on.cancelAt)}.` : on.currentPeriodEnd ? `Next payment ${planDate(on.currentPeriodEnd)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      detail: `No call-out fee, and their yearly service is included. ${on.lastServiceOn ? `Last service ${longDate(on.lastServiceOn)}.` : "No service on the plan yet."}`,
      failed: on.status === "past_due",
      leaving: !!on.cancelAt,
      cancelLabel: `Cancel${end ? ` (ends ${planDate(end.toISOString())})` : ""}`,
      send: null,
    };
  }
  return {
    on: false,
    line: planOpen(prices)
      ? plan?.status === "pending"
        ? "They've been sent the link but haven't joined yet."
        : plan?.status === "ended"
          ? "Their plan has ended."
          : "Not on the plan."
      : "Not on the plan. Set the plan's price in Settings to send them a link to join.",
    detail: null,
    failed: false,
    leaving: false,
    cancelLabel: null,
    send: planOpen(prices) ? (plan?.status === "pending" ? "Send the plan link again" : "Send them the plan") : null,
  };
}

/** Send the plan, cancel it (at the end of what's paid for, or now), or keep it going: the website's managePlan. */
export async function planAction(customerId: string, staffId: string, intent: string): Promise<Result> {
  if (intent === "send") {
    const result = await sendPlanInvite(customerId, staffId);
    if (!result.ok) return result;
    return { ok: true, message: result.sentVia.length ? `Plan link sent by ${viaPhrase(result.sentVia)}.` : "Saved, but we couldn't reach them: add an email or mobile." };
  }
  const member = await planFor(customerId);
  if (!member) return { ok: false, error: "They're not on the plan." };
  if (intent === "cancel" || intent === "end_now") {
    const result = await cancelPlan(member.id, { now: intent === "end_now" });
    if (!result.ok) return result;
    return { ok: true, message: result.endsOn ? `Cancelled. It ends on ${planDate(result.endsOn)}.` : "Plan ended." };
  }
  if (intent === "keep") {
    const result = await keepPlan(member.id);
    return result.ok ? { ok: true, message: "It carries on." } : result;
  }
  return { ok: false, error: "Nothing to do." };
}

// ---------------------------------------------------------------------------
// Photos and certificates.

export async function customerFiles(customerId: string) {
  const today = londonNow().dateISO;
  const files = await filesForCustomer(customerId).catch(() => []);
  return {
    today,
    certTypes: CERT_TYPES.map((t) => ({ key: t, label: CERT_LABEL[t] })),
    certificates: files
      .filter((f) => f.kind === "certificate")
      .map((f) => ({
        id: f.id,
        label: fileLabel(f),
        url: f.url,
        shared: f.shared,
        expired: !!f.expiresOn && f.expiresOn < today,
        detail: [
          f.issuedOn ? `Issued ${longDate(f.issuedOn)}` : "",
          f.expiresOn ? `${f.expiresOn < today ? "Ran out" : "Runs out"} ${longDate(f.expiresOn)}` : "",
          f.shared ? "In their account" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    photos: files.filter((f) => f.kind === "photo").map((f) => ({ id: f.id, label: f.enquiryId ? "From their booking" : fileLabel(f), url: f.url, shared: f.shared })),
  };
}

// ---------------------------------------------------------------------------
// Days off.

export async function daysOff() {
  const today = londonNow().dateISO;
  const days = await listDaysOff(today);
  const clashes = await Promise.all(
    days.map(async (d) => (await appointmentsBetween(d.startsOn, d.endsOn)).filter((a) => a.status === "booked" || a.status === "requested").length),
  );
  return {
    today,
    days: days.map((d, i) => ({
      id: d.id,
      startsOn: d.startsOn,
      when: d.startsOn === d.endsOn ? longDate(d.startsOn) : `${longDate(d.startsOn)} to ${longDate(d.endsOn)}`,
      note: d.note,
      clashes: clashes[i],
    })),
  };
}

export async function saveDayOff(body: { startsOn?: string; endsOn?: string; note?: string }, staffId: string): Promise<Result> {
  const startsOn = String(body.startsOn ?? "");
  const result = await addDayOff({ startsOn, endsOn: String(body.endsOn || startsOn), note: typeof body.note === "string" ? body.note : null, staffId });
  return result.ok ? { ok: true, message: "Saved." } : result;
}

export async function deleteDayOff(id: string): Promise<Result> {
  await removeDayOff(id);
  return { ok: true, message: "Removed." };
}

// ---------------------------------------------------------------------------
// Settings (admins).

const pounds = (pence: number | null | undefined) => (pence ? (pence / 100).toString() : "");

/** The month's calls and texts against the allowance, for Settings: what's used, what it's on, the prices, and the pause choice. */
export async function usageData() {
  const u = await monthUsage();
  return {
    spent: poundsFromPence(u.spentPence),
    allowance: poundsFromPence(u.allowancePence),
    percent: Math.min(100, Math.round((u.spentPence / u.allowancePence) * 100)),
    over: u.overPence ? poundsFromPence(u.overPence) : null,
    projected: poundsFromPence(u.projectedPence),
    projectedOver: u.projectedOverPence ? poundsFromPence(u.projectedOverPence) : null,
    parts: [
      ...u.parts.filter((p) => p.units > 0).map((p) => ({ label: p.label, detail: `${Number(p.units.toFixed(1))} ${p.unit}`, cost: poundsFromPence(p.pence) })),
      { label: "The MPE number", detail: "this month", cost: poundsFromPence(u.numberPence) },
    ],
    twilioChecked: u.twilioPence != null,
    pauseWhenUsed: u.pauseWhenUsed,
    paused: u.paused,
    rates: ratesInPence(),
  };
}

export async function settingsData() {
  const [products, review, plan, referral, usage, hours] = await Promise.all([
    listProducts(),
    getSetting("review_url").catch(() => null),
    planPrices(),
    referralRewards(),
    usageData().catch(() => null),
    teamHours(),
  ]);
  const have = new Set(products.map((p) => p.name.toLowerCase()));
  return {
    plan: {
      includes: PLAN_BENEFITS.map((b) => b.charAt(0).toLowerCase() + b.slice(1)).join(" and "),
      monthPrice: pounds(plan.monthPence),
      yearPrice: pounds(plan.yearPence),
      minMonths: plan.minMonths ? String(plan.minMonths) : "",
    },
    referrals: { referrerReward: pounds(referral?.referrerPence), friendReward: pounds(referral?.friendPence) },
    reviewUrl: review ?? "",
    usage,
    /** Opening hours (lib/team-hours.ts), minutes after midnight, and as words. */
    hours: { from: hours.from, until: hours.until, label: hoursLabel(hours) },
    maxUpsells: MAX_UPSELLS,
    products: products.map((p) => {
      const offer = p.upsellPricePence ?? defaultUpsellPrice(p.pricePence);
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: pounds(p.pricePence),
        upsellPrice: pounds(p.upsellPricePence),
        autoUpsellPrice: pounds(defaultUpsellPrice(p.pricePence)),
        upsell: p.upsell,
        offer: `At a repair: ${formatPence(offer)} (${Math.round((1 - offer / p.pricePence) * 100)}% off)`,
      };
    }),
    suggestions: SUGGESTED_PRODUCTS.filter((s) => !have.has(s.name.toLowerCase())).map((s) => ({
      name: s.name,
      description: s.description,
      price: pounds(s.pricePence),
      from: s.pricePence ? `from ${formatPence(s.pricePence)} on the site` : null,
      why: s.why,
    })),
  };
}

/** Pounds as typed, to pence within a range: null when blank, "bad" when it isn't. As the website's settings forms check them. */
function poundsIn(raw: unknown, max: number): number | null | "bad" {
  const value = String(raw ?? "").replace(/[£,\s]/g, "");
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= max ? Math.round(n * 100) : "bad";
}

export async function saveSettings(section: string, body: Record<string, unknown>): Promise<Result> {
  if (section === "plan") {
    const month = poundsIn(body.monthPrice, 5000);
    const year = poundsIn(body.yearPrice, 5000);
    if (month === "bad" || year === "bad") return { ok: false, error: "Prices need to be between £1 and £5,000." };
    const minRaw = String(body.minMonths ?? "").trim();
    const min = minRaw ? Number(minRaw) : 0;
    if (!Number.isInteger(min) || min < 0 || min > 24) return { ok: false, error: "The minimum term is a number of months, up to 24." };
    const ok = (
      await Promise.all([
        setSetting("plan_month_pence", month ? String(month) : null),
        setSetting("plan_year_pence", year ? String(year) : null),
        setSetting("plan_min_months", min ? String(min) : null),
      ])
    ).every(Boolean);
    if (!ok) return { ok: false, error: "Couldn't save that." };
    return { ok: true, message: month || year ? "Plan prices saved." : "Plan prices cleared: the plan can't be joined online until a price is set." };
  }
  if (section === "referrals") {
    const referrer = poundsIn(body.referrerReward, 500);
    const friend = poundsIn(body.friendReward, 500);
    if (referrer === "bad" || friend === "bad") return { ok: false, error: "Rewards need to be between £1 and £500." };
    const ok = (await Promise.all([setSetting("referral_referrer_pence", referrer ? String(referrer) : null), setSetting("referral_friend_pence", friend ? String(friend) : null)])).every(Boolean);
    if (!ok) return { ok: false, error: "Couldn't save that." };
    return { ok: true, message: referrer || friend ? "Referral rewards saved." : "Referrals switched off." };
  }
  if (section === "hours") {
    const from = Number(body.from);
    const until = Number(body.until);
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 24 * 60 && n % 30 === 0;
    if (!ok(from) || !ok(until) || from >= until) return { ok: false, error: "Pick an opening time before the closing time." };
    if (!(await setSetting("hours_from", String(from))) || !(await setSetting("hours_until", String(until)))) return { ok: false, error: "Couldn't save that." };
    forgetTeamHours();
    return { ok: true, message: `Open ${hoursLabel({ from, until })}, every day.` };
  }
  if (section === "usage") {
    const pause = body.pauseWhenUsed === true;
    if (!(await setSetting("twilio_pause_when_used", pause ? "1" : null))) return { ok: false, error: "Couldn't save that." };
    return { ok: true, message: pause ? "Once the allowance is used, calls and texts pause until the 1st." : "Calls and texts keep going after the allowance: the extra goes on your next invoice." };
  }
  if (section === "review") {
    const parsed = parseReviewUrl(String(body.reviewUrl ?? ""));
    if (!parsed.ok) return parsed;
    if (!(await setSetting("review_url", parsed.url))) return { ok: false, error: "Couldn't save that." };
    return { ok: true, message: parsed.url ? "Review link saved." : "Review link removed." };
  }
  return { ok: false, error: "Nothing to save." };
}

/** A product added, saved, offered at repairs (or not), or removed: the website's Settings products. */
export async function productAction(id: string | null, action: string, body: Record<string, unknown>): Promise<Result> {
  if (action === "add" || action === "save") {
    const parsed = productFromForm(jsonAsForm(body));
    if (!parsed.ok) return parsed;
    if (action === "add") return (await createProduct(parsed.fields)) ? { ok: true, message: `${parsed.fields.name} added.` } : { ok: false, error: "Couldn't add that." };
    if (!id) return { ok: false, error: "Which product?" };
    return (await updateProduct(id, parsed.fields)) ? { ok: true, message: `${parsed.fields.name} saved.` } : { ok: false, error: "Couldn't save that." };
  }
  if (!id) return { ok: false, error: "Which product?" };
  if (action === "upsell_on" || action === "upsell_off") {
    const result = await setUpsell(id, action === "upsell_on");
    return result.ok ? { ok: true, message: action === "upsell_on" ? "Now offered at repairs." : "No longer offered at repairs." } : result;
  }
  if (action === "remove") {
    await archiveProduct(id);
    return { ok: true, message: "Removed." };
  }
  return { ok: false, error: "Nothing to do." };
}
