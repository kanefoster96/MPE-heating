import type { Metadata } from "next";
import { business } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Have a question or need to book a callout? Send MPE a message and we'll get back to you — or call ${business.phoneDisplay} directly.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { url: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return <ContactForm />;
}
