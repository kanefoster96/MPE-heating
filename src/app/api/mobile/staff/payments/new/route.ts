import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { createInvoice, invoiceContext, type InvoiceBody } from "@/lib/app-invoice";

/** What the app's new invoice screen needs, for a visit (`?visit=`) or a customer (`?customer=`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const q = new URL(request.url).searchParams;
  const context = await invoiceContext({ visitId: q.get("visit"), customerId: q.get("customer") });
  return context ? mobileJson(context) : mobileJson({ error: "Pick the customer first." }, 404);
}

/** Saves a call-out fee or invoice, and sends it to them or keeps it to take now (lib/app-invoice.ts). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const result = await createInvoice(await readJson<InvoiceBody>(request), caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
