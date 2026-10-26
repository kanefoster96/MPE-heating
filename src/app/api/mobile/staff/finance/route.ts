import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffFinance } from "@/lib/app-menu";

/** The app's Finance screen (admins only, as on the website). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Finance is for admins." }, 403);
  return mobileJson(await staffFinance());
}
