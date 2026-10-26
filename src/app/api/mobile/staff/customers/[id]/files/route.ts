import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { customerFiles } from "@/lib/app-business";

/** A customer's photos and certificates, for the app (sharing and removing them is PATCH /api/mobile/staff/files). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return mobileJson({ error: "That customer has gone." }, 404);
  return mobileJson(await customerFiles(id));
}
