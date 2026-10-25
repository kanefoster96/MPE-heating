import { NextRequest, NextResponse } from "next/server";
import { business } from "@/lib/content";
import { formatPostcode, isValidEmail, isValidPhone, isValidPostcode } from "@/lib/validation";
import { isLikelyBotSubmission } from "@/lib/spamGuard";
import { ENQUIRY_TYPES, type EnquiryType } from "@/lib/enquiry";

// Delivers a booking/quote enquiry to the team's inbox via Resend's REST
// API (no SDK, one fetch). If RESEND_API_KEY isn't set the route answers
// 503 and the form shows the phone/WhatsApp fallback — better than a
// "thanks, we've got it" that went nowhere.

const RESEND_URL = "https://api.resend.com/emails";

type Payload = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  type?: unknown;
  sameDayRequested?: unknown;
  // The funnel choices that led here, e.g. ["Plumbing", "Leak or burst pipe"].
  path?: unknown;
  // The step-by-step forms: postcode, and each question with its answer.
  postcode?: unknown;
  answers?: unknown;
  // Bot checks (from Kanvas Academy): a honeypot real visitors never see
  // (`website`, or `company` on older forms) and how long the form was
  // open before sending, in milliseconds.
  website?: unknown;
  company?: unknown;
  fillMs?: unknown;
};

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }


  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  const email = str(body.email, 200);
  const message = str(body.message, 4000);
  const typeKey = str(body.type, 40) as EnquiryType;
  const type = ENQUIRY_TYPES[typeKey] ? typeKey : "other";
  const sameDayRequested = body.sameDayRequested === true;
  const path = Array.isArray(body.path)
    ? body.path.map((p) => str(p, 60)).filter(Boolean).slice(0, 6)
    : [];
  const postcodeRaw = str(body.postcode, 12);
  const postcode = postcodeRaw && isValidPostcode(postcodeRaw) ? formatPostcode(postcodeRaw) : "";
  const answers = Array.isArray(body.answers)
    ? body.answers
        .map((a) => (a && typeof a === "object" ? { q: str((a as { q?: unknown }).q, 120), a: str((a as { a?: unknown }).a, 600) } : null))
        .filter((a): a is { q: string; a: string } => !!a && !!a.q && !!a.a)
        .slice(0, 12)
    : [];

  // Bots get a quiet 200 and nothing is sent (Kanvas Academy's spam guard).
  const honeypot = str(body.website, 200) || str(body.company, 200);
  const fillMs = typeof body.fillMs === "number" ? body.fillMs : undefined;
  if (isLikelyBotSubmission({ website: honeypot, fillMs }, [name, message].filter(Boolean))) {
    return NextResponse.json({ ok: true });
  }

  // The booking forms send a name and phone; the quick email fields send
  // an email and a request, with a phone only if they want a call. So a
  // request needs something to act on and at least one way to reply.
  const hasPhone = isValidPhone(phone);
  const hasEmail = !!email && isValidEmail(email);
  // A request is a message of a sentence or more, or the answers from a
  // step-by-step form.
  const hasRequest = message.length >= 10 || answers.length > 0;
  if (!hasRequest || (!hasPhone && !hasEmail) || (name && name.length < 2)) {
    return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  }
  if (phone && !hasPhone) {
    return NextResponse.json({ error: "Check the phone number." }, { status: 400 });
  }
  if (email && !hasEmail) {
    return NextResponse.json({ error: "Check the email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email delivery isn't configured." }, { status: 503 });
  }

  const to = process.env.CONTACT_TO_EMAIL || business.email;
  const from = process.env.CONTACT_FROM_EMAIL || "MPE Website <onboarding@resend.dev>";
  const label = path.length ? path.join(" › ") : ENQUIRY_TYPES[type].label;
  const urgent = sameDayRequested ? " — SAME-DAY" : "";
  const subject = `${label}${urgent}: ${name || email || phone}${postcode ? ` (${postcode})` : ""}`;

  const lines = [
    `Request: ${label}${sameDayRequested ? " (same-day requested)" : ""}`,
    `Type: ${ENQUIRY_TYPES[type].label}`,
    `Name: ${name || "not given"}`,
    `Phone: ${phone || "not given"}`,
    `Email: ${email || "not given"}`,
    ...(postcode ? [`Postcode: ${postcode}`] : []),
    ...(answers.length ? ["", ...answers.map((a) => `${a.q}: ${a.a}`)] : []),
    ...(message ? ["", message] : []),
  ];

  const html = `<p><strong>${escapeHtml(label)}</strong>${
    sameDayRequested ? " &middot; <strong>same-day requested</strong>" : ""
  }</p>
<p><strong>Name:</strong> ${name ? escapeHtml(name) : "not given"}<br/>
<strong>Phone:</strong> ${phone ? `<a href="tel:${escapeHtml(phone.replace(/\s+/g, ""))}">${escapeHtml(phone)}</a>` : "not given"}<br/>
<strong>Email:</strong> ${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "not given"}${
    postcode ? `<br/><strong>Postcode:</strong> ${escapeHtml(postcode)}` : ""
  }</p>${
    answers.length
      ? `<ul>${answers.map((a) => `<li>${escapeHtml(a.q)}: <strong>${escapeHtml(a.a)}</strong></li>`).join("")}</ul>`
      : ""
  }${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}`;

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: lines.join("\n"),
        html,
        ...(email ? { reply_to: email } : {}),
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Couldn't send just now." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't send just now." }, { status: 502 });
  }
}
