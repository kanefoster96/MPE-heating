"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { addDayOff, removeDayOff } from "@/lib/days-off";

export async function saveDayOff(formData: FormData) {
  const user = await requireStaff("/staff/days-off");
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "") || startsOn;
  const result = await addDayOff({ startsOn, endsOn, note: String(formData.get("note") ?? ""), staffId: user.id });
  revalidatePath("/staff/days-off");
  revalidatePath("/staff/schedule");
  redirect(result.ok ? "/staff/days-off?done=1" : `/staff/days-off?error=${encodeURIComponent(result.error)}`);
}

export async function deleteDayOff(id: string) {
  await requireStaff("/staff/days-off");
  await removeDayOff(id);
  revalidatePath("/staff/days-off");
  revalidatePath("/staff/schedule");
  redirect("/staff/days-off");
}
