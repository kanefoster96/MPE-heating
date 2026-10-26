import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { planMembers } from "@/lib/app-business";

/** Everyone on the maintenance plan, for the app (the website's Plan members). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await planMembers());
}
