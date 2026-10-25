import { NextResponse } from "next/server";
import { getAppointmentByToken } from "@/lib/appointments";
import { markPublicReviewClicked } from "@/lib/job-completion";
import { enquiriesOn } from "@/lib/enquiries";
import { reviewUrl } from "@/lib/settings";

/** On to MPE's Google review page, noting they went (so the team can see who did). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = new URL(`/visit/${token}/review`, request.url);
  if (!enquiriesOn()) return NextResponse.redirect(back);
  const [visit, url] = await Promise.all([getAppointmentByToken(token), reviewUrl()]);
  if (!visit || !url) return NextResponse.redirect(back);
  await markPublicReviewClicked(visit.id);
  return NextResponse.redirect(url);
}
