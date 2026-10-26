import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { INVOICE_ACTIONS, invoiceAction, invoiceDetail, type InvoiceAction } from "@/lib/app-invoices";

/** One invoice in the app: its lines, what's in, what's left (lib/app-invoices.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const detail = await invoiceDetail(id);
  return detail ? mobileJson(detail) : mobileJson({ error: "That invoice has gone." }, 404);
}

/** One of its buttons: the link again, the receipt again, cancel, or its monthly payments. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const { action, amountPence } = await readJson<{ action: string; amountPence: number }>(request);
  if (!INVOICE_ACTIONS.includes(action as InvoiceAction)) return mobileJson({ error: "Nothing to do." }, 400);
  const result = await invoiceAction(id, action as InvoiceAction, typeof amountPence === "number" ? Math.round(amountPence) : null, caller.user.id);
  return result.ok ? mobileJson(result) : mobileJson({ error: result.error }, 400);
}
