import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { staffCustomer } from "@/lib/app-customer";

/** A customer for the team in the app, from their name in a chat (lib/app-customer.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const customer = /^[0-9a-f-]{36}$/i.test(id) ? await staffCustomer(id, caller.user.id) : null;
  return customer ? mobileJson(customer) : mobileJson({ error: "That customer has gone." }, 404);
}
