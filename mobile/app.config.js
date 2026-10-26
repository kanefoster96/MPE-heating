/**
 * The MPE app's build settings. A .js file rather than app.json so the
 * parts that depend on accounts MPE hasn't set up yet come from
 * environment variables (set them in EAS, see README.md):
 *
 * - EXPO_PUBLIC_SITE_URL: the website. Its address is where links in
 *   emails and texts open the app from (universal links on iPhone, app
 *   links on Android). The paths must match src/lib/app-links.ts on the
 *   site and lib/links.ts here.
 * - EAS_PROJECT_ID: the Expo project, needed for push notifications.
 * - TAP_TO_PAY_ENTITLEMENT=1: only once Apple has granted MPE's developer
 *   account Tap to Pay on iPhone. A build asking for an entitlement Apple
 *   hasn't granted fails to sign, so it's off until then.
 */
const site = (process.env.EXPO_PUBLIC_SITE_URL || "https://mpe-heating.vercel.app").replace(/\/+$/, "");
const host = new URL(site).host;
const APP_PATHS = ["/app-sign-in", "/messages", "/account", "/pay/", "/quote/", "/plan/", "/visit/", "/request/", "/help/", "/staff", "/staff/"];

module.exports = () => ({
  expo: {
    name: "MPE",
    slug: "mpe",
    scheme: "mpe",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    backgroundColor: "#ffffff",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "uk.co.mpenortheast.app",
      associatedDomains: [`applinks:${host}`, `webcredentials:${host}`],
      config: { usesNonExemptEncryption: false },
      entitlements: process.env.TAP_TO_PAY_ENTITLEMENT === "1" ? { "com.apple.developer.proximity-reader.payment.acceptance": true } : {},
    },
    android: {
      package: "uk.co.mpenortheast.app",
      adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#ffffff" },
      blockedPermissions: ["com.google.android.gms.permission.AD_ID"],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: APP_PATHS.map((p) => (p.endsWith("/") ? { scheme: "https", host, pathPrefix: p } : { scheme: "https", host, path: p })),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: { bundler: "metro", output: "single", favicon: "./assets/icon.png" },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      ["expo-notifications", { defaultChannel: "chat" }],
      [
        "expo-image-picker",
        {
          photosPermission: "MPE uses your photos so you can send the team a picture of your boiler or its error code.",
          cameraPermission: "MPE uses your camera so you can send the team a photo of your boiler or its error code.",
          microphonePermission: false,
        },
      ],
      [
        "@stripe/stripe-terminal-react-native",
        {
          tapToPayCheck: true,
          locationWhenInUsePermission: "MPE's engineers take card payments with Tap to Pay, which needs to know where the payment is taken.",
          bluetoothPeripheralPermission: "MPE's engineers can take card payments with a card reader.",
          bluetoothAlwaysUsagePermission: "MPE's engineers can take card payments with a card reader.",
          localNetworkUsagePermission: "MPE's engineers can take card payments with a card reader on the same Wi-Fi.",
        },
      ],
    ],
    extra: { eas: { projectId: process.env.EAS_PROJECT_ID || undefined } },
    experiments: { typedRoutes: false },
  },
});
