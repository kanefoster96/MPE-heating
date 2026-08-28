import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { CreateAccountForm } from "./CreateAccountForm";

export const metadata: Metadata = {
  title: "Create an Account",
  description:
    "Create an MPE account to track bookings, invoices and messages, and keep your address and boiler details on file.",
  alternates: { canonical: `${SITE_URL}/create-account` },
  robots: { index: false, follow: true },
};

export default function CreateAccountPage() {
  return <CreateAccountForm />;
}
