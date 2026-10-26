import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RowSkeleton, ServiceRow } from "@/components/rows";
import { AppText, FadeIn, LoadError, PressableScale, SectionHeading } from "@/components/ui";
import { openInApp } from "@/lib/open-link";
import { useHomeData } from "@/lib/use-home";
import { colors } from "@/lib/theme";

/** The Services tab: every service MPE offers, with its price and Book, then the maintenance plan. */
export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, load } = useHomeData();

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 10 }}>
        <SectionHeading label="Services and prices" lead="Everything we do." em="Price agreed first." />
        {error && !data ? (
          <LoadError message={error} onRetry={load} />
        ) : !data ? (
          [0, 1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} />)
        ) : (
          <>
            {data.services.map((s, i) => (
              <FadeIn key={s.id} index={i}>
                <ServiceRow service={s} onPress={() => openInApp(s.bookUrl)} />
              </FadeIn>
            ))}
            <FadeIn index={data.services.length} style={{ marginTop: 10 }}>
              <PressableScale onPress={() => openInApp(data.plan.bookUrl)} accessibilityLabel={`${data.plan.title}. ${data.plan.price ?? "Get the plan details"}`}>
                <View style={{ backgroundColor: colors.navy, borderRadius: 22, padding: 20 }}>
                  <AppText weight="bold" style={{ color: "#ffc53d", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase" }}>
                    {data.plan.title}
                  </AppText>
                  <AppText weight="extrabold" style={{ color: "#fff", fontSize: 24, marginTop: 4 }}>
                    {data.plan.headline}
                  </AppText>
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {data.plan.points.map((p) => (
                      <View key={p} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <Ionicons name="checkmark-circle" size={18} color="#ffc53d" />
                        <AppText style={{ color: "#fff", fontSize: 15 }}>{p}</AppText>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
                      {data.plan.price ?? "Get the plan details"}
                    </AppText>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  </View>
                </View>
              </PressableScale>
            </FadeIn>
          </>
        )}
      </ScrollView>
    </View>
  );
}
