import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { deleteFile, recordUpload, setShared, type CertType, type FileKind } from "@/lib/job-files";

type Body = {
  customerId: string;
  appointmentId: string | null;
  kind: FileKind;
  certType: CertType | null;
  title: string;
  path: string;
  contentType: string;
  size: number;
  issuedOn: string | null;
  expiresOn: string | null;
  shared: boolean;
};

/** Saves a photo or certificate once it's in storage (lib/job-files.ts), as the website's uploader does. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const b = await readJson<Body>(request);
  if (typeof b.customerId !== "string" || typeof b.path !== "string" || (b.kind !== "photo" && b.kind !== "certificate")) return mobileJson({ error: "Nothing to save." }, 400);
  const result = await recordUpload({
    staffId: caller.user.id,
    customerId: b.customerId,
    appointmentId: typeof b.appointmentId === "string" ? b.appointmentId : null,
    kind: b.kind,
    certType: b.certType ?? null,
    title: typeof b.title === "string" ? b.title : null,
    path: b.path,
    contentType: typeof b.contentType === "string" ? b.contentType : "application/octet-stream",
    size: typeof b.size === "number" ? b.size : 0,
    issuedOn: b.issuedOn ?? null,
    expiresOn: b.expiresOn ?? null,
    shared: b.shared !== false,
  });
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}

/** Shares a file with the customer or stops sharing it, or removes it (`action`). */
export async function PATCH(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { customerId, fileId, action } = await readJson<{ customerId: string; fileId: string; action: string }>(request);
  if (typeof customerId !== "string" || typeof fileId !== "string") return mobileJson({ error: "Which file?" }, 400);
  if (action === "share" || action === "unshare") await setShared(fileId, customerId, action === "share");
  else if (action === "remove") await deleteFile(fileId, customerId);
  else return mobileJson({ error: "Nothing to do." }, 400);
  return mobileJson({ ok: true });
}
