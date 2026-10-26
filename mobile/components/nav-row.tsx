import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { CountBadge } from "@/components/count-badge";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Kanvas Academy's menu rows, in MPE's light theme: a rounded card of rows with hairlines between. */
export function NavList({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

/** One row: an icon, what it is, a line on what's there, and a count if something's waiting. */
export function NavRow({ icon, title, description, badge = 0, onPress, last }: { icon: IconName; title: string; description?: string; badge?: number; onPress: () => void; last?: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${title}${badge ? `, ${badge} waiting` : ""}${description ? `. ${description}` : ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 60, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={18} color={colors.navy} />
          <CountBadge count={badge} top={-4} right={-6} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" style={{ fontSize: 16 }}>
            {title}
          </AppText>
          {description ? <AppText style={{ color: colors.text2, fontSize: 13, lineHeight: 18, marginTop: 1 }}>{description}</AppText> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </View>
    </PressableScale>
  );
}
