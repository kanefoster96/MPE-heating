import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { planAction } from "@/lib/app-business";
import { getCustomer } from "@/lib/customers";

/** Send a customer the plan, cancel theirs (at the end of what's paid for, or now), or keep it going. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await getCustomer(id))) return mobileJson({ error: "That customer has gone." }, 404);
  const { intent } = await readJson<{ intent?: string }>(request);
  const result = await planAction(id, caller.user.id, String(intent ?? ""));
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
