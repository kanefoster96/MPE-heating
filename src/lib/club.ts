/**
 * Who the business is, in the shape Kanvas Academy's messaging code reads
 * (its src/lib/club.ts, which reads club.json). The chat, texts, emails and
 * the app all take MPE's name, numbers and web address from here, filled
 * from the business details in content.ts so they're only written once.
 */
import { business } from "@/lib/content";

export const CLUB = {
  name: business.name,
  shortName: business.name,
  teamName: `${business.name} Team`,
  founded: null as number | null,
  domain: "mpe-heating.vercel.app",
  domainSpoken: "M P E heating dot vercel dot app",
  siteUrl: "https://mpe-heating.vercel.app",
  email: business.email,
  phone: business.phoneDisplay,
  phoneE164: "+447448628101",
  address: { town: business.base, region: business.baseRegion },
  app: {
    name: `${business.name} App`,
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
  },
};

/** One line, for footers and emails. MPE is a service-area business, so the town, not a street address. */
export const CLUB_ADDRESS = `${business.base}, ${business.baseRegion}`;

/** The live address of the site, for when NEXT_PUBLIC_SITE_URL is not set. */
export const CLUB_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || CLUB.siteUrl;

/** The web address as people type it: "mpe-heating.vercel.app/messages". */
export function clubLink(path = ""): string {
  return CLUB.domain + path;
}
