import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SITE_URL } from "@/lib/club";
import { business } from "@/lib/content";
import { getCustomer } from "@/lib/customers";
import { deliverToCustomer } from "@/lib/visit-notify";
import { renderEmailLayout } from "@/lib/emails/layout";
import { addDays, longDate } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";

/**
 * Photos and certificates kept with a customer or a visit: the team's
 * photos of the job, and certificates (gas safety records, service
 * records, Benchmark, commissioning). Kanvas One's "certificates kept with
 * the job" and "customer and property records with photos".
 *
 * Files go from the browser straight to the private "job-files" bucket
 * through a one-time signed upload (lib/upload-client.ts), then the row's
 * saved. They're only ever read through signed links made here, an hour
 * at a time. Shared files show in the customer's account and on the
 * visit's page. A gas safety record with an expiry date gets a renewal
 * reminder a month before (lib/follow-up-sweep.ts): landlords need one
 * every year.
 */

export const BUCKET = "job-files";
import { CERT_LABEL, CERT_TYPES, type CertType, type FileKind } from "@/lib/job-files-labels";
export { CERT_LABEL, CERT_TYPES, type CertType, type FileKind };

export type JobFile = {
  id: string;
  customerId: string | null;
  appointmentId: string | null;
  enquiryId: string | null;
  kind: FileKind;
  certType: CertType | null;
  title: string | null;
  contentType: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  shared: boolean;
  createdAt: string;
  /** A signed link, good for an hour. */
  url: string | null;
};

type Row = {
  id: string;
  customer_id: string | null;
  appointment_id: string | null;
  enquiry_id: string | null;
  kind: FileKind;
  cert_type: CertType | null;
  title: string | null;
  path: string;
  content_type: string | null;
  issued_on: string | null;
  expires_on: string | null;
  shared: boolean;
  created_at: string;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** A file's label: "Gas safety record", or its title, or "Photo". */
export function fileLabel(f: Pick<JobFile, "kind" | "certType" | "title">): string {
  return f.title || (f.kind === "certificate" ? CERT_LABEL[f.certType ?? "other"] : "Photo");
}

async function withUrls(rows: Row[]): Promise<JobFile[]> {
  if (!rows.length) return [];
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    appointmentId: r.appointment_id,
    enquiryId: r.enquiry_id,
    kind: r.kind,
    certType: r.cert_type,
    title: r.title,
    contentType: r.content_type,
    issuedOn: r.issued_on,
    expiresOn: r.expires_on,
    shared: r.shared,
    createdAt: r.created_at,
    url: urls.get(r.path) ?? null,
  }));
}

/** Everything for a customer (the team), or only what's shared with them (their account). */
export async function filesForCustomer(customerId: string, opts: { sharedOnly?: boolean } = {}): Promise<JobFile[]> {
  let query = createAdminClient().from("job_files").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200);
  if (opts.sharedOnly) query = query.eq("shared", true).is("enquiry_id", null);
  const { data } = await query;
  return withUrls((data ?? []) as Row[]);
}

/** A visit's shared files, for the customer's visit page. */
export async function sharedFilesForVisit(appointmentId: string): Promise<JobFile[]> {
  const { data } = await createAdminClient().from("job_files").select("*").eq("appointment_id", appointmentId).eq("shared", true).order("created_at");
  return withUrls((data ?? []) as Row[]);
}

/** A one-time upload for a team file: its own path under the customer, so nothing can be overwritten. */
export async function startUpload(params: { customerId: string; contentType: string; size: number }): Promise<{ path: string; token: string } | { error: string }> {
  if (!UUID.test(params.customerId) || !(await getCustomer(params.customerId))) return { error: "Customer not found." };
  if (!ALLOWED.test(params.contentType)) return { error: "Photos (JPEG, PNG, HEIC) or PDFs only." };
  if (!(params.size > 0) || params.size > MAX_BYTES) return { error: "That file's too big: up to 15MB." };
  const ext = params.contentType === "application/pdf" ? "pdf" : params.contentType === "image/png" ? "png" : params.contentType === "image/webp" ? "webp" : params.contentType.startsWith("image/hei") ? "heic" : "jpg";
  const path = `customers/${params.customerId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("job-files: couldn't start an upload", error);
    return { error: "Couldn't start the upload. Please try again." };
  }
  return { path: data.path, token: data.token };
}

/** Saves the row once the file's in storage. */
export async function recordUpload(params: {
  staffId: string;
  customerId: string;
  appointmentId?: string | null;
  kind: FileKind;
  certType?: CertType | null;
  title?: string | null;
  path: string;
  contentType: string;
  size: number;
  issuedOn?: string | null;
  expiresOn?: string | null;
  shared: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!params.path.startsWith(`customers/${params.customerId}/`) || params.path.includes("..")) return { ok: false, error: "That upload doesn't belong to this customer." };
  const date = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const { error } = await createAdminClient()
    .from("job_files")
    .insert({
      customer_id: params.customerId,
      appointment_id: params.appointmentId && UUID.test(params.appointmentId) ? params.appointmentId : null,
      kind: params.kind,
      cert_type: params.kind === "certificate" ? (CERT_TYPES.includes(params.certType as CertType) ? params.certType : "other") : null,
      title: params.title?.trim().slice(0, 120) || null,
      path: params.path,
      content_type: params.contentType.slice(0, 80),
      size_bytes: Math.round(params.size) || null,
      issued_on: params.kind === "certificate" ? date(params.issuedOn) : null,
      expires_on: params.kind === "certificate" ? date(params.expiresOn) : null,
      shared: params.shared,
      uploaded_by: params.staffId,
    });
  if (error) {
    console.error("job-files: couldn't save a file", error);
    return { ok: false, error: error.code === "23505" ? "That file's already saved." : "Couldn't save that file." };
  }
  return { ok: true };
}

export async function setShared(fileId: string, customerId: string, shared: boolean): Promise<void> {
  await createAdminClient().from("job_files").update({ shared }).eq("id", fileId).eq("customer_id", customerId);
}

export async function deleteFile(fileId: string, customerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("job_files").select("path").eq("id", fileId).eq("customer_id", customerId).maybeSingle();
  if (!data) return;
  await admin.storage.from(BUCKET).remove([data.path as string]);
  await admin.from("job_files").delete().eq("id", fileId);
}

// ---------------------------------------------------------------------------
// Renewals (lib/follow-up-sweep.ts).

const RENEWAL_NOTICE_DAYS = 30;

/** Gas safety records running out within a month: the customer's told, once each. Returns how many. */
export async function sendCertificateRenewals(budget: () => boolean): Promise<number> {
  const admin = createAdminClient();
  const today = londonNow().dateISO;
  const { data } = await admin
    .from("job_files")
    .select("id, customer_id, expires_on, cert_type")
    .eq("kind", "certificate")
    .eq("cert_type", "gas_safety")
    .gte("expires_on", today)
    .lte("expires_on", addDays(today, RENEWAL_NOTICE_DAYS))
    .is("renewal_reminded_at", null)
    .not("customer_id", "is", null)
    .limit(50);
  let sent = 0;
  for (const row of data ?? []) {
    if (!budget()) break;
    const customer = await getCustomer(row.customer_id as string);
    await admin.from("job_files").update({ renewal_reminded_at: new Date().toISOString() }).eq("id", row.id as string);
    if (!customer) continue;
    const where = [customer.address, customer.postcode].filter(Boolean).join(", ");
    const account = `${CLUB_SITE_URL.replace(/\/$/, "")}/account#files`;
    const body = `${customer.name ? `Hi ${customer.name.split(" ")[0]}, ` : "Hi, "}the gas safety record${where ? ` for ${where}` : ""} runs out on ${longDate(row.expires_on as string)}. Reply here or call ${business.phoneDisplay} to book the next check.`;
    const via = await deliverToCustomer(customer, {
      body,
      headline: "Your gas safety record is due",
      staffId: null,
      pushHref: "/account#files",
      smsOptOut: true,
      emailHtml: () =>
        renderEmailLayout({
          previewText: `Runs out on ${longDate(row.expires_on as string)}`,
          heading: "Your gas safety record is due",
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2a3a">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
          ctaLabel: "See your certificates",
          ctaUrl: account,
          secondaryCtaLabel: `Call ${business.phoneDisplay}`,
          secondaryCtaUrl: business.phoneHref,
        }),
    });
    if (via.length) sent++;
  }
  return sent;
}
