import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { business, type TwoTone } from "@/lib/content";
import { Heading, Eyebrow } from "./Heading";

// Shell for the booking form and its thank-you state: logo, a two-tone
// title, one line, then the card.
export function FormLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: TwoTone;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-4 py-10 sm:py-14">
      <Link href="/" className="mb-8 inline-flex min-h-11 items-center" aria-label={`${business.name} home`}>
        <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} priority className="h-10 w-auto" />
      </Link>

      <div className="w-full max-w-md text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading as="h1" lead={title.lead} em={title.em} emLine className="mt-3 text-3xl sm:text-4xl" />
        <p className="mt-3 text-base leading-relaxed text-text-2">{subtitle}</p>
      </div>

      <div className="mt-8 w-full max-w-md rounded-[28px] border border-line bg-white p-6 shadow-[0_24px_50px_-32px_rgba(31,42,58,0.35)] sm:p-8">
        {children}
      </div>

      <Link href="/" className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-text-2 hover:text-navy">
        ← Back to site
      </Link>
    </div>
  );
}
