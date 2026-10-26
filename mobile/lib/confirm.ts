import { Alert, Platform } from "react-native";

/**
 * "Are you sure?" with OK and Cancel, as a promise. The browser preview
 * has no native alerts, so it uses the browser's own there.
 */
export function confirmAction(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]);
  });
}

/** A one-button message ("Paid", "Not taken"), in the browser preview too. */
export function notify(title: string, message: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
