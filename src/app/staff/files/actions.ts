"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { deleteFile, recordUpload, setShared, startUpload, type CertType, type FileKind } from "@/lib/job-files";

/** A one-time upload for a team photo or certificate (the browser sends the file itself). */
export async function requestFileUpload(customerId: string, contentType: string, size: number) {
  await requireStaff(`/staff/customers/${customerId}`);
  return startUpload({ customerId, contentType, size });
}

export async function saveFileUpload(params: {
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
}) {
  const user = await requireStaff(`/staff/customers/${params.customerId}`);
  const result = await recordUpload({ staffId: user.id, ...params });
  revalidatePath(`/staff/customers/${params.customerId}`);
  return result;
}

export async function shareFile(customerId: string, fileId: string, shared: boolean) {
  await requireStaff(`/staff/customers/${customerId}`);
  await setShared(fileId, customerId, shared);
  revalidatePath(`/staff/customers/${customerId}`);
}

export async function removeFile(customerId: string, fileId: string) {
  await requireStaff(`/staff/customers/${customerId}`);
  await deleteFile(fileId, customerId);
  revalidatePath(`/staff/customers/${customerId}`);
}
