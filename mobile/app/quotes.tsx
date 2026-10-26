import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { RowSkeleton } from "@/components/rows";
import { AppText, FadeIn, LoadError, PressableScale, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { colors } from "@/lib/theme";

type Tab = "open" | "accepted" | "closed";
type List = { tab: Tab; count: number; total: string; items: { id: string; customer: string; title: string; amount: string; tone: "good" | "bad" | "plain"; detail: string }[] };
const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Waiting" },
  { key: "accepted", label: "Accepted" },
  { key: "closed", label: "Last 90 days" },
];

/** Every quote (the website's Quotes, in the app): waiting for them, accepted and to do, and the last 90 days. */
export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("open");
  const [data, setData] = useState<List | null>(() => readCached<List>("/api/mobile/staff/quotes?show=open") ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setError(null);
    try {
      setData(await apiFetch<List>(`/api/mobile/staff/quotes?show=${t}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load quotes.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (staff) load(tab);
    }, [staff, tab, load]),
  );

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;
  const shown = data?.tab === tab ? data : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Quotes" />
      <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 4 }}>
        {TABS.map((t) => (
          <PressableScale
            key={t.key}
            onPress={() => {
              setTab(t.key);
              setData(readCached<List>(`/api/mobile/staff/quotes?show=${t.key}`) ?? null);
            }}
            accessibilityLabel={`${t.label}${tab === t.key ? ", selected" : ""}`}
            style={{ height: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: tab === t.key ? colors.navy : colors.card, borderWidth: 1, borderColor: tab === t.key ? colors.navy : colors.edge }}
          >
            <AppText weight="semibold" style={{ color: tab === t.key ? "#fff" : colors.navy, fontSize: 14 }}>
              {t.label}
            </AppText>
          </PressableScale>
        ))}
      </View>
      {error && !shown ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={() => load(tab)} />
        </View>
      ) : !shown ? (
        <View style={{ padding: 12, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={shown.items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 110, gap: 8 }}
          ListHeaderComponent={
            <AppText style={{ color: colors.text2, fontSize: 14, marginLeft: 4, marginBottom: 4 }}>{shown.count ? `${shown.count} · ${shown.total}` : "None."}</AppText>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.orangeDeep}
              onRefresh={async () => {
                setRefreshing(true);
                await load(tab);
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <PressableScale onPress={() => router.push(`/quote/${item.id}`)} accessibilityLabel={`${item.customer}, ${item.title}, ${item.amount}, ${item.detail}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: item.tone === "good" ? colors.success : colors.edge, padding: 14 }}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
                      {item.customer}
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 13 }} numberOfLines={1}>
                      {item.title}
                    </AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText weight="extrabold" style={{ fontSize: 17 }}>
                      {item.amount}
                    </AppText>
                    <AppText weight={item.tone === "plain" ? "regular" : "bold"} style={{ fontSize: 12, color: item.tone === "good" ? colors.success : item.tone === "bad" ? colors.danger : colors.text2 }}>
                      {item.detail}
                    </AppText>
                  </View>
                </View>
              </PressableScale>
            </FadeIn>
          )}
        />
      )}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
        <PrimaryButton title="New quote" icon="add" onPress={() => router.push("/new-quote")} />
      </View>
    </View>
  );
}
