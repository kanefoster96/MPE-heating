import type { Metadata } from "next";
import { CalloutsAdmin } from "./CalloutsAdmin";

export const metadata: Metadata = { title: "Requests & jobs" };

export default function CalloutsAdminPage() {
  return <CalloutsAdmin />;
}
