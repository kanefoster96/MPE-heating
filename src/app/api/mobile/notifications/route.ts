import { NextResponse } from "next/server";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { noticesFor } from "@/lib/app-notifications";

/** The app's bell: what's waiting on this customer, or on the team (lib/app-notifications.ts). */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson({ notices: await noticesFor(caller.user, caller.staff).catch(() => []) });
}
