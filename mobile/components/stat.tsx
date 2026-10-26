import { View } from "react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/lib/theme";

/** A number with its label and a line under it (Kanvas Academy's stat tile, light). */
export function Stat({ label, value, sub, tone = "plain" }: { label: string; value: string; sub?: string; tone?: "plain" | "alert" | "good" }) {
  const color = tone === "alert" ? colors.orangeDeep : tone === "good" ? colors.success : colors.navy;
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.edge, padding: 14 }} accessible accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ""}`}>
      <AppText weight="semibold" style={{ color: colors.text2, fontSize: 13 }}>
        {label}
      </AppText>
      <AppText weight="extrabold" style={{ fontSize: 24, lineHeight: 29, color, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {sub ? <AppText style={{ color: colors.text2, fontSize: 12, lineHeight: 16, marginTop: 2 }}>{sub}</AppText> : null}
    </View>
  );
}

/** Two stats side by side. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

/**
 * Plain bars, one per row (Kanvas Academy's finance bar chart, light):
 * the label, the bar, the value. Readable without colour, every value
 * written out.
 */
export function Bars({ rows, highlight }: { rows: { label: string; value: number; display: string }[]; highlight?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessible accessibilityLabel={`${r.label}: ${r.display}`}>
          <AppText weight="semibold" style={{ width: 92, fontSize: 13, color: colors.text2 }} numberOfLines={1}>
            {r.label}
          </AppText>
          <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.grey, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, height: "100%", borderRadius: 7, backgroundColor: i === highlight ? colors.orangeDeep : colors.navy }} />
          </View>
          <AppText weight="bold" style={{ width: 74, textAlign: "right", fontSize: 13 }}>
            {r.display}
          </AppText>
        </View>
      ))}
    </View>
  );
}
