import { redirect } from "next/navigation";

// The app's Jobs tab, linked from the team's "Waiting on you" reminder. On the website, the return visits to book are with the schedule's waiting list.
export default function StaffJobsPage() {
  redirect("/staff/schedule?waiting=1#waiting");
}
