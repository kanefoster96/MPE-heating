import { createAdminClient } from "@/lib/supabase/admin";
import { enquiriesOn } from "@/lib/enquiries";

/**
 * Photos added on a booking form. The browser asks for a one-time signed
 * upload (api/uploads/booking-photo), sends the shrunk photo straight to
 * the private "job-files" bucket, and posts the paths with the form; once
 * the enquiry is saved they're filed in job_files against it and the
 * customer. Server-only: everything goes through the service-role client.
 */

export const BOOKING_PHOTO_BUCKET = "job-files";

/** The most photos one booking can attach (the form stops at the same number). */
export const MAX_BOOKING_PHOTOS = 5;

/**
 * Upload attempts allowed per form before the browser starts a fresh
 * folder. Higher than MAX_BOOKING_PHOTOS so removing a photo and adding
 * another, or trying again after a failed upload, still works.
 */
export const MAX_PHOTO_SLOTS = 20;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_ONLY = new RegExp(`^${UUID}$`);
// Exactly the paths the upload route makes, so a form can never point a
// job at any other file in the bucket.
const PHOTO_PATH = new RegExp(`^enquiries/(${UUID})/([1-9]\\d?)\\.jpg$`);

export function isBatchId(value: unknown): value is string {
  return typeof value === "string" && UUID_ONLY.test(value);
}

/** Where upload `n` of a form's photos goes: enquiries/<uuid>/<n>.jpg. */
export function bookingPhotoPath(batch: string, n: number): string {
  return `enquiries/${batch}/${n}.jpg`;
}

/** The form's `photos`, keeping only paths we could have made, at most five. */
export function bookingPhotoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ok = value.filter((p): p is string => {
    if (typeof p !== "string") return false;
    const m = PHOTO_PATH.exec(p);
    return !!m && Number(m[2]) <= MAX_PHOTO_SLOTS;
  });
  return [...new Set(ok)].slice(0, MAX_BOOKING_PHOTOS);
}

/**
 * Files the booking's photos on its job and customer. Only photos that
 * really reached storage are filed (checked by listing their folder), and
 * a path already filed is left alone. Returns how many are on the job.
 * Never throws: a photo going wrong must not lose the booking.
 */
export async function attachBookingPhotos(enquiryId: string, customerId: string | null, paths: string[]): Promise<number> {
  if (!paths.length || !enquiriesOn()) return 0;
  try {
    const admin = createAdminClient();
    const folders = [...new Set(paths.map((p) => p.slice(0, p.lastIndexOf("/"))))];
    const found = new Map<string, { size?: number; mimetype?: string }>();
    for (const folder of folders) {
      const { data, error } = await admin.storage.from(BOOKING_PHOTO_BUCKET).list(folder, { limit: 100 });
      if (error) {
        console.error("attachBookingPhotos: listing failed", folder, error);
        continue;
      }
      for (const f of data ?? []) found.set(`${folder}/${f.name}`, (f.metadata ?? {}) as { size?: number; mimetype?: string });
    }
    const rows = paths.flatMap((path) => {
      const meta = found.get(path);
      if (!meta) return [];
      return [{
        customer_id: customerId,
        enquiry_id: enquiryId,
        kind: "photo",
        title: "From the booking form",
        path,
        content_type: typeof meta.mimetype === "string" ? meta.mimetype : "image/jpeg",
        size_bytes: typeof meta.size === "number" ? meta.size : null,
        shared: true,
      }];
    });
    if (!rows.length) return 0;
    const { data, error } = await admin.from("job_files").upsert(rows, { onConflict: "path", ignoreDuplicates: true }).select("id");
    if (error) {
      console.error("attachBookingPhotos: insert failed", enquiryId, error);
      return 0;
    }
    return data?.length ?? 0;
  } catch (err) {
    console.error("attachBookingPhotos failed", enquiryId, err);
    return 0;
  }
}

/**
 * The booking-form photos on each of these jobs, oldest first, with signed
 * links that last an hour (the bucket is private). Jobs without photos
 * are left out of the map.
 */
export async function photosForEnquiries(ids: string[]): Promise<Map<string, { id: string; url: string }[]>> {
  const map = new Map<string, { id: string; url: string }[]>();
  if (!ids.length || !enquiriesOn()) return map;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("job_files")
      .select("id, enquiry_id, path")
      .in("enquiry_id", ids)
      .eq("kind", "photo")
      .order("created_at");
    if (error) {
      // Most likely the job_files table isn't in the database yet.
      console.error("photosForEnquiries: query failed", error);
      return map;
    }
    const rows = (data ?? []) as { id: string; enquiry_id: string; path: string }[];
    if (!rows.length) return map;
    const { data: signed, error: signError } = await admin.storage.from(BOOKING_PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.path), 60 * 60);
    if (signError) {
      console.error("photosForEnquiries: signing failed", signError);
      return map;
    }
    const urlFor = new Map<string, string>();
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) urlFor.set(s.path, s.signedUrl);
    for (const r of rows) {
      const url = urlFor.get(r.path);
      if (!url) continue;
      map.set(r.enquiry_id, [...(map.get(r.enquiry_id) ?? []), { id: r.id, url }]);
    }
    return map;
  } catch (err) {
    console.error("photosForEnquiries failed", err);
    return map;
  }
}
