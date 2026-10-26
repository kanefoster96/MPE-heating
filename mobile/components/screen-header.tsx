import type { ReactNode } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors } from "@/lib/theme";

/** A pushed screen's header: back on the left, the title in the middle, room for an action or two on the right. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityLabel="Back"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </PressableScale>
        <AppText weight="bold" numberOfLines={1} accessibilityRole="header" style={{ flex: 1, textAlign: "center", fontSize: 17 }}>
          {title}
        </AppText>
        <View style={{ minWidth: 44, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>{right}</View>
      </View>
    </View>
  );
}
