import type { ComponentProps } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/lib/theme";

/** An honest "coming next" for a tab that isn't built yet (Kanvas Academy's placeholder screen). */
export function PlaceholderScreen({ icon, title, description }: { icon: ComponentProps<typeof Ionicons>["name"]; title: string; description: string }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, paddingTop: insets.top + 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Ionicons name={icon} size={32} color={colors.orangeDeep} />
      </View>
      <AppText weight="bold" style={{ fontSize: 22 }}>
        {title}
      </AppText>
      <AppText style={{ color: colors.text2, fontSize: 15, marginTop: 6, textAlign: "center", lineHeight: 21 }}>{description}</AppText>
    </ScrollView>
  );
}
