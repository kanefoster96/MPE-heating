import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { apiFetch, apiPost } from "@/lib/api";

/**
 * Push notifications (Kanvas Academy's lib/push.ts): a reply in chat, a
 * visit booked, an invoice. Asked for at a moment it makes sense (after
 * their first chat message, or on signing in) rather than on first launch.
 * The token goes to the website (/api/mobile/push-token), which sends
 * through Expo (src/lib/push.ts on the site).
 *
 * Needs a real phone and an EAS project id (app.config.js extra.eas): in
 * Expo Go's web preview or a simulator it quietly does nothing.
 */

let registeredToken: string | null = null;

/** Android shows nothing for a channel the app hasn't made. The site sends on these two. */
async function makeChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("chat", { name: "Messages", importance: Notifications.AndroidImportance.HIGH });
  await Notifications.setNotificationChannelAsync("classes", { name: "Visits and payments", importance: Notifications.AndroidImportance.HIGH });
}

/** Asks (once; the phone remembers the answer) and registers this phone for the signed-in account. Returns whether it's on. */
export async function registerForPush(): Promise<boolean> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return false;
    await makeChannels();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiPost("/api/mobile/push-token", { token, platform: Platform.OS });
    registeredToken = token;
    return true;
  } catch {
    return false;
  }
}

/** Signing out: this phone stops getting that account's pushes. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await apiFetch("/api/mobile/push-token", { method: "DELETE", body: JSON.stringify({ token }) }).catch(() => {});
}

/** The number on the app icon: unread chat plus things waiting. */
export function setIconBadge(count: number): void {
  if (Platform.OS === "web") return;
  Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
}

export type PushData = { kind?: string; conversationId?: string; href?: string | null };
