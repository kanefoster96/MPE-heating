import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/content";

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
      <Link href="/" className="mb-8">
        <Image
          src="/mpe-logo.png"
          alt={business.fullName}
          width={1189}
          height={513}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_20px_45px_-15px_rgba(31,42,58,0.25)] sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-navy/70">{subtitle}</p>

        <div className="mt-8">{children}</div>

        <p className="mt-8 text-center text-sm text-navy/70">{footer}</p>
      </div>

      <Link href="/" className="mt-8 text-sm font-medium text-navy/50 hover:text-navy">
        ← Back to site
      </Link>
    </div>
  );
}
