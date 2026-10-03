import { NextRequest, NextResponse } from "next/server";
import { business } from "@/lib/content";
import { isValidEmail, isValidPhone } from "@/lib/validation";
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
  // Honeypot: real visitors never see this field, bots fill it in.
  company?: unknown;
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

  // Bots that fill the hidden field get a quiet 200 and nothing is sent.
  if (str(body.company, 200)) {
    return NextResponse.json({ ok: true });
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

  if (name.length < 2 || !isValidPhone(phone) || message.length < 10) {
    return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
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
  const subject = `${label}${urgent}: ${name}`;

  const lines = [
    `Request: ${label}${sameDayRequested ? " (same-day requested)" : ""}`,
    `Type: ${ENQUIRY_TYPES[type].label}`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email || "not given"}`,
    "",
    message,
  ];

  const html = `<p><strong>${escapeHtml(label)}</strong>${
    sameDayRequested ? " &middot; <strong>same-day requested</strong>" : ""
  }</p>
<p><strong>Name:</strong> ${escapeHtml(name)}<br/>
<strong>Phone:</strong> <a href="tel:${escapeHtml(phone.replace(/\s+/g, ""))}">${escapeHtml(phone)}</a><br/>
<strong>Email:</strong> ${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "not given"}</p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

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
