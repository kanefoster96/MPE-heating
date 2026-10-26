import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { certificatesDue } from "@/lib/app-menu";

/** Certificates running out in the next 60 days (lib/app-menu.ts). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson({ certificates: await certificatesDue() });
}
