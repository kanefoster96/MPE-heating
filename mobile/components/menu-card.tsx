import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors } from "@/lib/theme";
import type { MenuCard as Card } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Orange when something needs him, green when it's all in order, white when it's just a number. */
const TONE = {
  alert: { bg: colors.orangeLight, border: colors.orangeDeep, value: colors.orangeDeep, icon: colors.orangeDeep, iconBg: "#fff" },
  good: { bg: "#e5f3ea", border: "#a9d3b8", value: colors.success, icon: colors.success, iconBg: "#fff" },
  plain: { bg: colors.card, border: colors.edge, value: colors.navy, icon: colors.navy, iconBg: colors.grey },
} as const;

/** One of the Menu's cards: an icon, the number that matters, and a line on it. */
export function MenuCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const t = TONE[card.tone];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${card.title}: ${card.value}. ${card.caption}${card.tone === "alert" ? ". Needs you" : ""}`} style={{ flex: 1 }}>
      <View style={{ backgroundColor: t.bg, borderRadius: 22, borderWidth: card.tone === "alert" ? 1.5 : 1, borderColor: t.border, padding: 14, minHeight: 138, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.iconBg, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={card.icon as IconName} size={19} color={t.icon} />
          </View>
          {card.tone === "alert" ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orangeDeep }} /> : card.tone === "good" ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
        </View>
        <View>
          <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2, marginTop: 8 }}>
            {card.title}
          </AppText>
          <AppText weight="extrabold" style={{ fontSize: 24, lineHeight: 28, color: t.value }} numberOfLines={1} adjustsFontSizeToFit>
            {card.value}
          </AppText>
          <AppText style={{ fontSize: 12, lineHeight: 16, color: colors.text2, marginTop: 2 }} numberOfLines={2}>
            {card.caption}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}
