import { View } from "react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/lib/theme";

/** The small orange count on a tab or the bell (Kanvas Academy's count-badge). Nothing at zero. */
export function CountBadge({ count, top = -4, right = -6 }: { count: number; top?: number; right?: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        top,
        right,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: colors.orangeDeep,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: colors.page,
      }}
    >
      <AppText weight="bold" style={{ color: "#fff", fontSize: 10, lineHeight: 12 }}>
        {count > 9 ? "9+" : count}
      </AppText>
    </View>
  );
}
