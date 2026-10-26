import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { customerOptions } from "@/lib/app-schedule";

/** Finding a customer in the app: by name, email, phone or postcode (`?q=`); the newest without one. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson({ customers: await customerOptions((new URL(request.url).searchParams.get("q") ?? "").slice(0, 60)) });
}
