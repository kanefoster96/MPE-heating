import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, PressableScale, Skeleton } from "@/components/ui";
import { colors } from "@/lib/theme";
import type { GuideSummary, HomeData, ServiceIcon } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Service = HomeData["services"][number];

export const SERVICE_ICON: Record<ServiceIcon, IconName> = {
  boiler: "flame",
  service: "build",
  newboiler: "cube",
  plumbing: "water",
  electrics: "flash",
  landlord: "document-text",
};

/** A rounded square with an icon in it: the leading edge of every row. */
export function IconTile({ name, size = 48, tone = "orange" }: { name: IconName; size?: number; tone?: "orange" | "navy" }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone === "orange" ? colors.orangeLight : colors.grey, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={size * 0.5} color={tone === "orange" ? colors.orangeDeep : colors.navy} />
    </View>
  );
}

/** One service: icon, name, one line, its price, and a tap to book. */
export function ServiceRow({ service, onPress }: { service: Service; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${service.title}, ${service.price}. Book`}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
        <IconTile name={SERVICE_ICON[service.icon] ?? "build"} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 16 }}>
            {service.title}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 1 }} numberOfLines={2}>
            {service.headline}
          </AppText>
          <AppText weight="bold" style={{ fontSize: 13, color: colors.orangeDeep, marginTop: 4 }}>
            {service.price}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Card>
    </PressableScale>
  );
}

/** One help guide as a list row. */
export function GuideRow({ guide, onPress }: { guide: GuideSummary; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={guide.title}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
        <IconTile name="book" tone="navy" size={44} />
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={2}>
            {guide.title}
          </AppText>
          <AppText style={{ color: colors.text3, fontSize: 13, marginTop: 2 }}>
            {guide.category} · {guide.readTime}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Card>
    </PressableScale>
  );
}

/** A grey stand-in for a row while it loads. */
export function RowSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, padding: 14 }}>
      <Skeleton width={48} height={48} radius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="50%" height={15} radius={7} />
        <Skeleton width="80%" height={12} radius={6} />
      </View>
    </View>
  );
}

/** A small section title with an optional action on the right ("See all"). */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 20 }}>
        {title}
      </AppText>
      {action && onAction ? (
        <PressableScale onPress={onAction} accessibilityLabel={action} style={{ height: 44, justifyContent: "center", paddingLeft: 12 }}>
          <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
            {action}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}
