import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { productAction } from "@/lib/app-business";

/** A product added (`action: "add"`), saved, offered at repairs or not, or removed (`id` and `action`). Admins only. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Settings are for admins." }, 403);
  const body = await readJson<Record<string, unknown>>(request);
  const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  const result = await productAction(id, String(body.action ?? ""), body);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
