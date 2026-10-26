import { NextResponse } from "next/server";
import { jsonAsForm, mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { staffCustomer } from "@/lib/app-customer";
import { customerFieldsFromForm, getCustomer, updateCustomer } from "@/lib/customers";

/** A customer for the team in the app, from their name in a chat (lib/app-customer.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const customer = /^[0-9a-f-]{36}$/i.test(id) ? await staffCustomer(id, caller.user.id) : null;
  return customer ? mobileJson(customer) : mobileJson({ error: "That customer has gone." }, 404);
}

/** Their details and boiler, from the app, checked as the website's form checks them. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await getCustomer(id))) return mobileJson({ error: "That customer has gone." }, 404);
  const parsed = customerFieldsFromForm(jsonAsForm(await readJson<Record<string, unknown>>(request)));
  if (!parsed.ok) return mobileJson({ error: parsed.error }, 400);
  const result = await updateCustomer(id, parsed.fields);
  return result.ok ? mobileJson({ ok: true }) : mobileJson({ error: result.error }, 400);
}
