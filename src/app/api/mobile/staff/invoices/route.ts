import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { INVOICE_TABS, invoiceList, type InvoiceTab } from "@/lib/app-invoices";

/** The app's invoices: unpaid, paying monthly or paid in the last 90 days (`?show=`). */
export async function GET(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const show = new URL(request.url).searchParams.get("show");
  return mobileJson(await invoiceList(INVOICE_TABS.includes(show as InvoiceTab) ? (show as InvoiceTab) : "unpaid"));
}
