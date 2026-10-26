// The website's light palette (src/app/globals.css :root on the site) as a
// plain object: React Native has no CSS custom properties. Keep in step by
// hand if the site's tokens change.
export const colors = {
  page: "#ffffff",
  cream: "#f7f5f2",
  card: "#ffffff",
  grey: "#f1efeb",
  edge: "#ece8e3",
  line: "rgba(31, 42, 58, 0.09)",
  navy: "#1f2a3a",
  text2: "#5b6573",
  text3: "#8a909a",
  orange: "#e8623a",
  orangeDark: "#cf5029",
  orangeDeep: "#b5411c",
  orangeLight: "#fbe4db",
  whatsapp: "#178245",
  whatsappTint: "#e5f3ea",
  success: "#136b39",
  danger: "#c81e1e",
  /** The loading boxes: a step darker than the cream behind them. */
  skeleton: "#e5e0d9",
} as const;

/** The site's orange button gradient (--grad), deep to bright. */
export const orangeGradient = [colors.orangeDeep, colors.orangeDark, colors.orange] as const;

export const fonts = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extrabold: "Outfit_800ExtraBold",
} as const;
