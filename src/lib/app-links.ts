/**
 * Which of the site's links open the MPE app instead, when it's installed
 * (Kanvas Academy's lib/app-links.ts). A customer taps "Pay now" in a text
 * or "View your quote" in an email, and it opens in the app, signed in,
 * rather than in the browser.
 *
 * iOS asks the site: Apple fetches /.well-known/apple-app-site-association
 * (src/app/.well-known) and opens the app only for the paths listed there.
 * Android asks the app: the same paths are in the intent filter in
 * mobile/app.config.js, and /.well-known/assetlinks.json vouches that the
 * app is MPE's. mobile/app/+native-intent.tsx turns each address into the
 * screen it opens. The three lists must agree: change one, change all
 * three.
 *
 * Both files answer 404 until APPLE_TEAM_ID and ANDROID_CERT_SHA256 are
 * set, which leaves every link opening the website as now. Exclusions come
 * first: Apple uses the first entry that matches.
 */

/** The app's bundle id and Android package (mobile/app.config.js). */
export const APP_ID = "uk.co.mpenortheast.app";

const COMPONENTS: Record<string, unknown>[] = [
  // The "add to calendar" file needs the browser to hand it to the calendar.
  { "/": "/visit/*/calendar.ics", exclude: true, comment: "Calendar files stay on the website" },
  // The "Confirm my email" button in the app's sign-in email (lib/app-sign-in.ts).
  { "/": "/app-sign-in" },
  { "/": "/messages" },
  { "/": "/account" },
  { "/": "/account/*" },
  { "/": "/pay/*" },
  { "/": "/quote/*" },
  { "/": "/plan/*" },
  { "/": "/visit/*" },
  { "/": "/request/*" },
  { "/": "/help/*" },
  // The team's pages: on the phone, the app has them all (mobile/lib/links.ts).
  { "/": "/staff" },
  { "/": "/staff/*" },
];

const TEAM_ID = /^[A-Z0-9]{10}$/;
const SHA256_FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** The Apple Team ID (APPLE_TEAM_ID), or null while it's unset or isn't one. */
export function appleTeamId(): string | null {
  const id = (process.env.APPLE_TEAM_ID ?? "").trim().toUpperCase();
  return TEAM_ID.test(id) ? id : null;
}

/** The Android signing-key fingerprints (ANDROID_CERT_SHA256, comma-separated AB:CD:… values). */
export function androidFingerprints(): string[] {
  return (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => SHA256_FINGERPRINT.test(f));
}

/** The apple-app-site-association file, or null while there's no Team ID to put in it. */
export function appleAppSiteAssociation(): Record<string, unknown> | null {
  const teamId = appleTeamId();
  if (!teamId) return null;
  const appId = `${teamId}.${APP_ID}`;
  return {
    applinks: { details: [{ appIDs: [appId], components: COMPONENTS }] },
    // Lets iOS offer the saved email when they sign in to the app.
    webcredentials: { apps: [appId] },
  };
}

/** The assetlinks.json statements, or null while there's no fingerprint. */
export function androidAssetLinks(): Record<string, unknown>[] | null {
  const fingerprints = androidFingerprints();
  if (!fingerprints.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
