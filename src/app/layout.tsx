import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { business } from "@/lib/content";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${business.fullName} | Boiler Repairs & Servicing, North East`,
  description:
    "Same-day boiler repairs across the North East. Gas Safe engineer, price agreed before any work starts. £50 call-out deducted from your final bill.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-navy">
        {children}
      </body>
    </html>
  );
}
