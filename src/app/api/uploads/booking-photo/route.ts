import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enquiriesOn } from "@/lib/enquiries";
import { BOOKING_PHOTO_BUCKET, MAX_PHOTO_SLOTS, bookingPhotoPath, isBatchId } from "@/lib/enquiry-photos";

// A one-time signed upload for one photo on a booking form, so the photo
// goes from the phone straight to storage (lib/upload-client.ts) rather
// than through here. Anyone can ask (the form is public), so the path is
// always ours to choose, the file has to say it's a photo of a sensible
// size, and each address gets a limited number. Nothing is filed on a job
// until the booking itself is sent (api/contact).

// Before the browser shrinks it: a phone photo is rarely over 10MB.
const MAX_BYTES = 10 * 1024 * 1024;

// A soft guard against someone filling the bucket: per address, in this
// server's memory only, so it resets when the function restarts and
// isn't shared between instances. The form itself stops at five.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 30;
const recent = new Map<string, { count: number; resetAt: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  // Keep the map small: drop windows that have ended.
  if (recent.size > 5000) for (const [key, v] of recent) if (v.resetAt <= now) recent.delete(key);
  const entry = recent.get(ip);
  if (!entry || entry.resetAt <= now) {
    recent.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= PER_WINDOW;
}

export async function POST(request: NextRequest) {
  if (!enquiriesOn()) {
    return NextResponse.json({ error: "Photo uploads aren't set up." }, { status: 503 });
  }

  let body: { contentType?: unknown; size?: unknown; batch?: unknown; n?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  const size = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : 0;
  if (!/^image\/[a-z0-9.+-]{1,40}$/.test(contentType)) {
    return NextResponse.json({ error: "Photos only." }, { status: 415 });
  }
  if (size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too big." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allowed(ip)) {
    return NextResponse.json({ error: "Too many photos. Try again later." }, { status: 429 });
  }

  // The form's photos share a folder: the one it was given with its first
  // photo, else a new one. Upload numbers past the limit get a new folder.
  const n = typeof body.n === "number" && Number.isInteger(body.n) && body.n >= 1 && body.n <= MAX_PHOTO_SLOTS ? body.n : 1;
  const batch = isBatchId(body.batch) && n > 1 ? body.batch : crypto.randomUUID();
  const path = bookingPhotoPath(batch, n);

  // Not upsert: a path that's already been used can't be written over.
  const { data, error } = await createAdminClient().storage.from(BOOKING_PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("booking-photo: signed upload failed", error);
    return NextResponse.json({ error: "Couldn't get that ready." }, { status: 502 });
  }
  return NextResponse.json({ path, token: data.token, batch });
}
