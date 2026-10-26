/**
 * Where the website is: the app reads its content (services, prices,
 * guides) from the site's /api/mobile routes and opens the site's booking
 * forms in its in-app browser. EXPO_PUBLIC_SITE_URL points a development
 * build at a local server; otherwise it's the live site. Switch the
 * default to https://mpenortheast.co.uk once the domain points at it.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://mpe-heating.vercel.app").replace(/\/$/, "");

/**
 * The number customers call: the MPE number once EXPO_PUBLIC_MPE_PHONE is
 * set (it rings Fergal and logs the call in their chat), else his own.
 */
const MPE_E164 = (process.env.EXPO_PUBLIC_MPE_PHONE || "+447448628101").replace(/\s+/g, "");
const national = MPE_E164.startsWith("+44") ? `0${MPE_E164.slice(3)}` : MPE_E164;
export const MPE_PHONE = {
  href: `tel:${MPE_E164}`,
  display: national.startsWith("07") ? `${national.slice(0, 5)} ${national.slice(5)}` : `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`,
};
