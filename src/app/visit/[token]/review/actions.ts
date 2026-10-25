"use server";

import { redirect } from "next/navigation";
import { getAppointmentByToken } from "@/lib/appointments";
import { saveJobReview } from "@/lib/job-completion";

export async function submitReview(token: string, formData: FormData) {
  const visit = await getAppointmentByToken(token);
  if (!visit || visit.status !== "done") redirect(`/visit/${token}`);
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) redirect(`/visit/${token}/review?error=1`);
  const comment = String(formData.get("comment") ?? "");
  if (!(await saveJobReview(visit, rating, comment))) redirect(`/visit/${token}/review?error=1`);
  redirect(`/visit/${token}/review?thanks=1`);
}
