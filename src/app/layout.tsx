import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { business } from "@/lib/content";
import { SITE_URL, localBusinessJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { MetaPixel } from "@/components/MetaPixel";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { CONSENT_COOKIE_NAME, CONSENT_SET_CLASS } from "@/lib/cookie-consent";

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
        {/* Hides the cookie banner before first paint for someone who has
            already answered it, without the server reading cookies (which
            would stop every page being static). Only once the pixel is set
            up; until then there's no banner. */}
        {META_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if(/(?:^|; )${CONSENT_COOKIE_NAME}=/.test(document.cookie))document.documentElement.classList.add('${CONSENT_SET_CLASS}')`,
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-page text-navy">
        {/* Before the page, so the pixel is ready by the time the page's own
            events (a service page's ViewContent) fire. Renders nothing. */}
        <MetaPixel />
        {children}
        <JsonLd data={localBusinessJsonLd()} />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
