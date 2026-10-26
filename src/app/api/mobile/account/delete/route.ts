import { NextResponse } from "next/server";
import { mobileCaller, mobileJson } from "@/lib/mobile-api";
import { deleteAccount } from "@/lib/account-delete";

/** Delete my account, from inside the app (lib/account-delete.ts). */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const result = await deleteAccount(caller.user);
  if (!result.ok) return mobileJson({ error: result.error }, result.status);
  return mobileJson({ ok: true });
}
