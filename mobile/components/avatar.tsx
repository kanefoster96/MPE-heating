import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/lib/theme";

// Kanvas Academy's avatar-circle: a name always gets the same colour. Dark
// enough for white initials on each (4.5:1 or better).
const PALETTE = [colors.navy, colors.orangeDeep, colors.success, "#5b3fb0", "#0e6a86", "#8a3a6b"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Their photo, else their initials, else (signed out) a person outline. */
export function Avatar({ name, url, size = 36 }: { name?: string | null; url?: string | null; size?: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.grey }} accessibilityIgnoresInvertColors />;
  if (!name) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="person" size={size * 0.52} color={colors.text3} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorForName(name), alignItems: "center", justifyContent: "center" }}>
      <AppText weight="bold" style={{ color: "#fff", fontSize: size * 0.38 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}
