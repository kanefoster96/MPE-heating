import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, Card, FadeIn, LoadError, PressableScale, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { colors } from "@/lib/theme";

type Member = { id: string; customerId: string; name: string; detail: string; status: string; tone: "good" | "bad" | "plain" };
type Plan = { prices: string; stats: { members: number; monthly: string; failed: number; leaving: number }; live: Member[]; ended: Member[] };
const PATH = "/api/mobile/staff/plan";

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: alert ? colors.danger : colors.edge, backgroundColor: alert ? "#fdecec" : colors.card, padding: 14 }}>
      <AppText style={{ color: colors.text2, fontSize: 12 }}>{label}</AppText>
      <AppText weight="extrabold" style={{ fontSize: 24, color: alert ? colors.danger : colors.navy }}>
        {value}
      </AppText>
    </View>
  );
}

function MemberRow({ m, onPress }: { m: Member; onPress: () => void }) {
  const ink = m.tone === "bad" ? colors.danger : m.tone === "good" ? colors.success : colors.text2;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${m.name}, ${m.status}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, padding: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
            {m.name}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 13 }}>{m.detail}</AppText>
          <AppText weight="bold" style={{ color: ink, fontSize: 13, marginTop: 2 }}>
            {m.status}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text3} />
      </View>
    </PressableScale>
  );
}

/**
 * Everyone on the maintenance plan (the website's Plan members, in the
 * app): what it brings in, failed payments, who's leaving, and each
 * member, which opens their page to cancel or keep their plan.
 */
export default function PlanScreen() {
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<Plan | null>(() => readCached<Plan>(PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<Plan>(PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the plan.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Maintenance plan" />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={170} radius={20} />
          <Skeleton height={80} radius={18} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.orangeDeep}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          <Card style={{ gap: 6 }}>
            <AppText style={{ fontSize: 15, lineHeight: 21 }}>{data.prices}</AppText>
            {me?.admin && (
              <PressableScale onPress={() => router.push("/settings")} accessibilityLabel="Plan prices in Settings" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                  Prices in Settings ›
                </AppText>
              </PressableScale>
            )}
          </Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Stat label="Members" value={String(data.stats.members)} />
            <Stat label="A month, roughly" value={data.stats.monthly} />
            <Stat label="Payment failed" value={String(data.stats.failed)} alert={data.stats.failed > 0} />
            <Stat label="Leaving" value={String(data.stats.leaving)} />
          </View>

          <AppText weight="bold" accessibilityRole="header" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6, marginLeft: 4 }}>
            On the plan
          </AppText>
          {data.live.length ? (
            data.live.map((m, i) => (
              <FadeIn key={m.id} index={Math.min(i, 8)}>
                <MemberRow m={m} onPress={() => router.push(`/customer/${m.customerId}`)} />
              </FadeIn>
            ))
          ) : (
            <AppText style={{ color: colors.text2, fontSize: 14, marginLeft: 4 }}>No one yet. Send someone the plan from their customer page.</AppText>
          )}

          {data.ended.length > 0 && (
            <>
              <AppText weight="bold" accessibilityRole="header" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6, marginLeft: 4 }}>
                Left in the last 90 days
              </AppText>
              {data.ended.map((m) => (
                <MemberRow key={m.id} m={m} onPress={() => router.push(`/customer/${m.customerId}`)} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
