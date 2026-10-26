/**
 * Where the website is: the app reads its content (services, prices,
 * guides) from the site's /api/mobile routes and opens the site's booking
 * forms in its in-app browser. EXPO_PUBLIC_SITE_URL points a development
 * build at a local server; otherwise it's the live site. Switch the
 * default to https://mpenortheast.co.uk once the domain points at it.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://mpe-heating.vercel.app").replace(/\/$/, "");
