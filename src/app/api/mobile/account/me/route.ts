import { NextResponse } from "next/server";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";
import { myAccount, myAccountAction } from "@/lib/app-account";

/** A customer's own account in the app (lib/app-account.ts): everything on the website's /account. */
export async function GET(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  return mobileJson(await myAccount(caller.user));
}

/** Saving their details, asking for a visit, their plan and cards (`action`). */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const result = await myAccountAction(caller.user, await readJson<Record<string, unknown>>(request));
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
