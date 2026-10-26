import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffOverview } from "@/lib/app-menu";

/** Fergal's Menu: the cards, orange where something needs him (lib/app-menu.ts). Money only for admins. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson({ ...(await staffOverview(caller.user, caller.admin)), admin: caller.admin });
}
