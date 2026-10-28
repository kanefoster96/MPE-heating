import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { saveSettings, settingsData } from "@/lib/app-business";

/** Settings in the app (admins only, as on the website): plan prices, referral rewards, the review link, products. */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Settings are for admins." }, 403);
  return mobileJson(await settingsData());
}

/** One section saved (`section`: plan, referrals, review, usage or hours). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Settings are for admins." }, 403);
  const body = await readJson<Record<string, unknown>>(request);
  const result = await saveSettings(String(body.section ?? ""), body);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
