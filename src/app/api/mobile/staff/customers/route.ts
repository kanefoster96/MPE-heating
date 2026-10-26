import { NextResponse } from "next/server";
import { jsonAsForm, mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { customerOptions } from "@/lib/app-schedule";
import { customerList } from "@/lib/app-business";
import { createCustomer, customerFieldsFromForm } from "@/lib/customers";

/**
 * Finding a customer in the app: by name, email, phone or postcode (`?q=`);
 * the newest without one. `?all=1` is the Customers list (up to 200).
 */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, 60);
  if (params.get("all")) return mobileJson({ customers: await customerList(q) });
  return mobileJson({ customers: await customerOptions(q) });
}

/** A new customer from the app, checked as the website's form checks them. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const parsed = customerFieldsFromForm(jsonAsForm(await readJson<Record<string, unknown>>(request)));
  if (!parsed.ok) return mobileJson({ error: parsed.error }, 400);
  const created = await createCustomer(parsed.fields);
  return created.ok ? mobileJson({ id: created.id }) : mobileJson({ error: created.error }, 400);
}
