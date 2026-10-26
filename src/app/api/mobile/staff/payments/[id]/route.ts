import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { paymentSheetFor } from "@/lib/app-payments";

/** One open invoice for the app's Payment sheet, from the Payment tab (lib/app-payments.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const sheet = await paymentSheetFor(id);
  return sheet ? mobileJson(sheet) : mobileJson({ error: "That's been paid or cancelled." }, 404);
}
