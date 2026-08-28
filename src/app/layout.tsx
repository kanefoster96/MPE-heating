import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { business } from "@/lib/content";
import { SITE_URL, localBusinessJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const defaultTitle = `${business.fullName} | Boiler Repairs, Servicing, Plumbing & Electrics`;
const defaultDescription =
  "Gas Safe registered boiler repairs, servicing, new boiler installs, plumbing and electrics across the North East. Same-day response, £50 call-out refunded when fixed, 30-day guarantee on every job.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: defaultTitle,
    template: `%s | ${business.name}`,
  },
  description: defaultDescription,
  alternates: { canonical: SITE_URL },
  // Deliberately no title/description/url here — Next.js falls back to
  // the resolved page title/description automatically, which is what we
  // want (each page's own metadata flows through to its OG/Twitter card
  // instead of every page sharing the homepage's).
  openGraph: {
    siteName: business.fullName,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-navy">
        {children}
        <JsonLd data={localBusinessJsonLd()} />
      </body>
    </html>
  );
}
