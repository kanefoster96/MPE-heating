import Image from "next/image";
import { business, footerLinks } from "@/lib/content";
import { GasSafeMarkIcon, ShieldIcon, AwardIcon, PhoneIcon } from "./icons";

export function Footer() {
  return (
    <footer className="bg-navy pb-24 pt-14 text-white sm:pb-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div>
            <Image
              src="/mpe-logo.png"
              alt={business.fullName}
              width={1189}
              height={513}
              className="h-14 w-auto"
            />

            <div className="mt-5 flex flex-col gap-2 text-sm text-white/80">
              <a href={business.phoneHref} className="inline-flex items-center gap-2 hover:text-white">
                <PhoneIcon className="h-4 w-4" />
                {business.phoneDisplay}
              </a>
              <a href={`mailto:${business.email}`} className="hover:text-white">
                {business.email}
              </a>
              <p className="text-white/50">Gas Safe registration: {business.gasSafeNumber}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Company</p>
            {footerLinks.map((l) => (
              <a key={l.label} href={l.href} className="text-white/80 hover:text-white">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Accredited
            </p>
            <div className="flex items-center gap-4 text-white/60">
              <GasSafeMarkIcon className="h-7 w-7" />
              <ShieldIcon className="h-7 w-7" />
              <AwardIcon className="h-7 w-7" />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {business.fullName}. All rights reserved.
          </p>
          <p>Site by Pixel Kanvas.</p>
        </div>
      </div>
    </footer>
  );
}
