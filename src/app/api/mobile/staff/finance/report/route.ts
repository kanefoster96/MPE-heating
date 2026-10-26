import { NextResponse } from "next/server";
import { mobileJson, mobileStaff } from "@/lib/mobile-api";
import { previousMonth, sendMonthReport } from "@/lib/monthly-report";
import { londonNow } from "@/lib/schedule-time";

/** "Email me last month's numbers" (admins), as on the website's Home. It goes to them on the 1st anyway. */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.admin) return mobileJson({ error: "Finance is for admins." }, 403);
  if (!caller.user.email) return mobileJson({ error: "There's no email on your login to send it to." }, 400);
  const ok = await sendMonthReport(previousMonth(londonNow().dateISO.slice(0, 7)), [caller.user.email]);
  return ok ? mobileJson({ message: `Sent to ${caller.user.email}. It goes to the admins on the 1st of every month too.` }) : mobileJson({ error: "Couldn't send it: is Resend set up?" }, 500);
}
