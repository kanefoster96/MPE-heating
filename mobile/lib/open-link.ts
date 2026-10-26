import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { apiPost } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

/**
 * Opens a page of the website without leaving the app: Safari View
 * Controller on iOS, a Custom Tab on Android, sliding up as a sheet. Kanvas
 * Academy's app was rejected once for sending people out to Safari, so
 * every website link goes through here. Phone, WhatsApp and email links
 * use openExternal.
 */
export async function openInApp(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: "close",
      controlsColor: "#b5411c",
    });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}

/**
 * A website page that needs them signed in (their account, the team's
 * pages): the site makes a one-time sign-in link for it
 * (/api/mobile/web-session), so the in-app browser doesn't ask again.
 */
export async function openSignedIn(path: string): Promise<void> {
  const fallback = `${SITE_URL}${path}`;
  const result = await apiPost<{ url: string }>("/api/mobile/web-session", { path }).catch(() => ({ url: fallback }));
  await openInApp(result.url || fallback);
}

/** A phone call, WhatsApp or email: the phone's own app. */
export function openExternal(url: string): void {
  Linking.openURL(url).catch(() => {});
}

/** Directions to an address in the phone's maps app (Apple Maps, or Google Maps on Android). */
export function openDirections(address: string): void {
  const q = encodeURIComponent(address);
  const url = Platform.OS === "ios" ? `maps://?daddr=${q}` : Platform.OS === "android" ? `geo:0,0?q=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => {}));
}
