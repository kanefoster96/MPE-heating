import Image from "next/image";
import Link from "next/link";
import { business, footerLinks, accreditations } from "@/lib/content";
import { PhoneIcon, WhatsAppIcon } from "./icons";

export function Footer() {
  return (
    <footer className="border-t border-line bg-cream py-12 text-navy">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div>
            <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} className="h-12 w-auto" />
            <div className="mt-5 flex flex-col gap-2 text-sm text-text-2">
              <a href={business.phoneHref} className="inline-flex min-h-11 items-center gap-2 hover:text-navy">
                <PhoneIcon className="h-4 w-4" />
                {business.phoneDisplay}
              </a>
              <a
                href={business.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 hover:text-navy"
              >
                <WhatsAppIcon className="h-4 w-4 text-whatsapp" />
                WhatsApp us
              </a>
              <a href={`mailto:${business.email}`} className="inline-flex min-h-11 items-center hover:text-navy">
                {business.email}
              </a>
              <p className="text-text-3">Gas Safe registration: {business.gasSafeNumber}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-text-3">Company</p>
            {footerLinks.map((l) =>
              l.href ? (
                <Link key={l.label} href={l.href} className="inline-flex min-h-11 items-center text-text-2 hover:text-navy">
                  {l.label}
                </Link>
              ) : (
                <span key={l.label} className="inline-flex min-h-11 items-center text-text-2">
                  {l.label}
                </span>
              )
            )}
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-text-3">Accredited</p>
            {accreditations.map((a) => (
              <span key={a} className="inline-flex min-h-11 items-center text-text-2">
                {a}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-center text-xs text-text-3">
          &copy; {new Date().getFullYear()} {business.fullName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
