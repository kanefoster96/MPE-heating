import { NextResponse } from "next/server";
import { getAppointmentByToken } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { enquiriesOn } from "@/lib/enquiries";
import { visitIcs } from "@/lib/ics";
import { KIND_LABEL, windowLabel } from "@/lib/day-plan";
import { business } from "@/lib/content";

/** The customer's visit as a calendar file, from the link on their visit page. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!enquiriesOn()) return new NextResponse("Not found", { status: 404 });
  const visit = await getAppointmentByToken(token);
  if (!visit || visit.status !== "booked") return new NextResponse("Not found", { status: 404 });
  const customer = visit.customerId ? await getCustomer(visit.customerId) : null;
  const location = [visit.address ?? customer?.address, visit.postcode ?? customer?.postcode].filter(Boolean).join(", ");
  const body = visitIcs({
    uid: `${visit.id}@mpe`,
    title: `${business.name}: ${KIND_LABEL[visit.kind]}`,
    day: visit.day,
    start: visit.start,
    end: visit.end,
    location,
    description: `${KIND_LABEL[visit.kind]} with ${business.name}, arriving between ${windowLabel(visit.start, visit.end).replace("–", " and ")}. Can't make it? Call ${business.phoneDisplay}.`,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mpe-visit-${visit.day}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
