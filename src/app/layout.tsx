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

const defaultTitle = `Boiler Repairs Whitley Bay & North East | Same-Day Call-Outs | ${business.name}`;
const defaultDescription =
  "Same-day boiler repairs in Whitley Bay and across the North East. Gas Safe engineers, £50 call-out refunded when we fix it, price agreed before we start, 3-month guarantee. Servicing from £79, new boilers, plumbing and electrics.";

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

const KANVAS_SITE_ID = process.env.NEXT_PUBLIC_KANVAS_SITE_ID;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} h-full antialiased`}
      // The inline script below adds a class before hydration, on purpose.
      suppressHydrationWarning
    >
      <head>
        {/* Marks the page as JS-capable before first paint, so the
            scroll-in fades (.js .reveal) never hide content when scripts
            fail to load. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-navy">
        {children}
        <JsonLd data={localBusinessJsonLd()} />
        {/* Kanvas One: visitor counts for the app, and live chat that also
            lands in the One app. Only once the site's One id is set in
            NEXT_PUBLIC_KANVAS_SITE_ID (see NEW-SITE.md in the One repo). */}
        {KANVAS_SITE_ID && (
          <>
            <script src="https://kanvas.one/beacon.js" data-site={KANVAS_SITE_ID} defer />
            <script
              src="https://kanvas.one/chat.js"
              data-site={KANVAS_SITE_ID}
              data-name="MPE"
              data-color="#b5411c"
              data-trigger="#chatButton"
              data-full=""
              defer
            />
          </>
        )}
      </body>
    </html>
  );
}
