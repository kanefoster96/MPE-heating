import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors } from "@/lib/theme";

export type GridDay = { day: string; count?: number; requested?: number; closed?: boolean };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** "2026-10" plus or minus some months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Every day of a month, for a grid with no counts (the visit form's date picker). */
export function bareMonth(month: string): GridDay[] {
  const out: GridDay[] = [];
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) out.push({ day: `${month}-${String(d).padStart(2, "0")}` });
  return out;
}

/**
 * A month, Monday first: each day's number, with a dot per visit (orange
 * for a request) and days off greyed. The picked day is navy, today has a
 * ring. Arrows either side of the month change it.
 */
export function MonthGrid({
  month,
  days,
  today,
  selected,
  onPick,
  onMonth,
  past = true,
}: {
  month: string;
  days: GridDay[];
  today: string;
  selected: string | null;
  onPick: (day: string) => void;
  onMonth: (month: string) => void;
  /** Whether days before today can be picked. */
  past?: boolean;
}) {
  const first = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const lead = (first + 6) % 7;
  const cells: (GridDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (GridDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale onPress={() => onMonth(shiftMonth(month, -1))} accessibilityLabel="Previous month" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </PressableScale>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
          {monthLabel(month)}
        </AppText>
        <PressableScale onPress={() => onMonth(shiftMonth(month, 1))} accessibilityLabel="Next month" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={22} color={colors.navy} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((w, i) => (
          <AppText key={i} weight="semibold" style={{ flex: 1, textAlign: "center", color: colors.text3, fontSize: 12 }}>
            {w}
          </AppText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row" }}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={{ flex: 1, height: 48 }} />;
            const on = d.day === selected;
            const isToday = d.day === today;
            const before = !past && d.day < today;
            const dots = Math.min(d.count ?? 0, 4);
            return (
              <PressableScale
                key={d.day}
                onPress={() => (before ? undefined : onPick(d.day))}
                disabled={before}
                accessibilityLabel={`${new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${d.closed ? ", day off" : d.count ? `, ${d.count} visit${d.count === 1 ? "" : "s"}` : ""}${d.requested ? `, ${d.requested} requested` : ""}${on ? ", selected" : ""}`}
                style={{ flex: 1, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 44,
                    height: 48,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? colors.navy : d.closed ? colors.grey : "transparent",
                    borderWidth: isToday && !on ? 2 : 0,
                    borderColor: colors.orangeDeep,
                  }}
                >
                  <AppText weight={on || isToday ? "extrabold" : "semibold"} style={{ fontSize: 16, color: on ? "#fff" : d.closed ? colors.text3 : colors.navy }}>
                    {Number(d.day.slice(8))}
                  </AppText>
                  <View style={{ flexDirection: "row", gap: 2, height: 6, marginTop: 2 }}>
                    {Array.from({ length: dots }, (_, i) => (
                      <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? "#fff" : colors.success }} />
                    ))}
                    {d.requested ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? "#ffc53d" : colors.orangeDeep }} /> : null}
                  </View>
                </View>
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}
