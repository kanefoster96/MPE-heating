"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { completeJob } from "@/lib/job-completion";
import { viaPhrase } from "@/lib/visit-notify";

/** Marks the job done with what was done, the boiler details, a note for next time, and the summary and review ask. */
export async function finishJob(id: string, day: string, formData: FormData) {
  const user = await requireStaff(`/staff/jobs/${id}/finish`);
  const get = (key: string) => String(formData.get(key) ?? "");
  const result = await completeJob({
    appointmentId: id,
    staffId: user.id,
    report: get("report"),
    privateNote: get("privateNote"),
    boiler: { boilerMake: get("boilerMake"), boilerModel: get("boilerModel"), boilerAge: get("boilerAge"), boilerLocation: get("boilerLocation") },
    servicedToday: formData.get("servicedToday") === "on",
    sendSummary: formData.get("sendSummary") === "on",
    askReview: formData.get("askReview") === "on",
  });
  if (!result.ok) redirect(`/staff/jobs/${id}/finish?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/staff/schedule");
  const sent = result.sentVia.length ? ` Summary sent by ${viaPhrase(result.sentVia)}.` : "";
  redirect(`/staff/schedule?${new URLSearchParams({ view: "day", date: day, success: "finished", note: `Job done.${sent}` }).toString()}#visit-${id}`);
}
