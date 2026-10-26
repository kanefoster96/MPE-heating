"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { isAdmin } from "@/lib/coach";
import { previousMonth, sendMonthReport } from "@/lib/monthly-report";
import { londonNow } from "@/lib/schedule-time";

/** "Email me last month's numbers" on Home. */
export async function emailLastMonth() {
  const user = await requireStaff("/staff");
  if (!(await isAdmin(user.id)) || !user.email) redirect("/staff");
  const ok = await sendMonthReport(previousMonth(londonNow().dateISO.slice(0, 7)), [user.email]);
  redirect(`/staff?report=${ok ? "sent" : "failed"}`);
}
