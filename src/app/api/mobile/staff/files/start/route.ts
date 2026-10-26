import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { startUpload } from "@/lib/job-files";

/** A one-time upload for a photo or certificate from the app; the app then sends the file straight to storage. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { customerId, contentType, size } = await readJson<{ customerId: string; contentType: string; size: number }>(request);
  if (typeof customerId !== "string" || typeof contentType !== "string" || typeof size !== "number") return mobileJson({ error: "Nothing to upload." }, 400);
  const result = await startUpload({ customerId, contentType, size });
  return "error" in result ? mobileJson(result, 400) : mobileJson(result);
}
