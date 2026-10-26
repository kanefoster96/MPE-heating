import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Bars, Stat, StatRow } from "@/components/stat";
import { AppText, Card, LoadError, PressableScale, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { StaffMetrics } from "@/lib/types";

const pounds = (p: number) => `£${Math.round(p / 100).toLocaleString("en-GB")}`;
function change(now: number, before: number, money = false): string {
  if (!before && !now) return "Same as the month before";
  const diff = now - before;
  if (!diff) return "Same as the month before";
  return `${diff > 0 ? "Up" : "Down"} ${money ? pounds(Math.abs(diff)) : Math.abs(diff)} on ${before ? "the month before" : "none the month before"}`;
}

/**
 * Metrics (Kanvas Academy's metrics screen): one month in numbers against
 * the one before, the same as the monthly report email. Money in, jobs
 * done, new jobs and where they came from, quotes won, the plan, reviews
 * and referrals. Step back a month with the arrows.
 */
export default function MetricsScreen() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<StaffMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (which: string | null = month) => {
    setError(null);
    try {
      setData(await apiFetch<StaffMetrics>(`/api/mobile/staff/metrics${which ? `?month=${which}` : ""}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load metrics.");
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function go(which: string) {
    setMonth(which);
    setData(null);
    load(which);
  }
  const thisMonth = new Date().toISOString().slice(0, 7);
  const next = (() => {
    if (!data) return null;
    const [y, m] = data.month.split("-").map(Number);
    const n = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return n <= thisMonth ? n : null;
  })();

  const n = data?.now;
  const b = data?.before;
  const winRate = n && n.quotesSent ? Math.round((n.quotesWon / n.quotesSent) * 100) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Metrics" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <PressableScale onPress={() => data && go(data.previous)} accessibilityLabel="The month before" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </PressableScale>
          <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 22 }}>
            {data?.label ?? "This month"}
          </AppText>
          <PressableScale onPress={() => next && go(next)} disabled={!next} accessibilityLabel="The month after" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-forward" size={24} color={next ? colors.navy : colors.text3} />
          </PressableScale>
        </View>

        {error && !data ? (
          <LoadError message={error} onRetry={() => load()} />
        ) : !n || !b ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={90} radius={20} />)
        ) : (
          <>
            <StatRow>
              <Stat label="Money in" value={pounds(n.takenPence)} sub={change(n.takenPence, b.takenPence, true)} />
              <Stat label="Jobs done" value={String(n.jobsDone)} sub={change(n.jobsDone, b.jobsDone)} />
            </StatRow>
            <StatRow>
              <Stat label="New jobs" value={String(n.enquiries)} sub={`From booking forms. ${change(n.enquiries, b.enquiries)}`} />
              <Stat label="Quotes won" value={`${n.quotesWon} of ${n.quotesSent}`} sub={n.quotesWonPence ? `${pounds(n.quotesWonPence)}${winRate !== null ? `, ${winRate}% won` : ""}` : "None won yet"} tone={n.quotesWon ? "good" : "plain"} />
            </StatRow>
            <StatRow>
              <Stat label="Reviews" value={n.reviews ? `${n.reviewAverage?.toFixed(1)}★` : "–"} sub={n.reviews ? `${n.reviews} review${n.reviews === 1 ? "" : "s"}, ${n.toGoogle} to Google` : "None this month"} tone={n.reviewAverage && n.reviewAverage >= 4.5 ? "good" : "plain"} />
              <Stat label="Plan members" value={String(n.planMembers)} sub={`${n.planJoined} joined, ${n.planLeft} left`} tone={n.planLeft > n.planJoined ? "alert" : "plain"} />
            </StatRow>
            <Card style={{ gap: 14, marginTop: 6 }}>
              <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
                Where new jobs came from
              </AppText>
              {n.bySource.length ? (
                <Bars rows={n.bySource.map((s) => ({ label: s.source, value: s.count, display: String(s.count) }))} />
              ) : (
                <AppText style={{ color: colors.text2 }}>No booking forms this month yet.</AppText>
              )}
              <AppText style={{ color: colors.text2, fontSize: 12, lineHeight: 17 }}>
                From the link they first arrived by (an advert, Google, a referral). Ad spend is in Meta Ads Manager.
              </AppText>
            </Card>
            <StatRow>
              <Stat label="Referrals" value={String(n.referrals)} sub={change(n.referrals, b.referrals)} />
              <Stat label="Payments" value={String(n.payments)} sub={change(n.payments, b.payments)} />
            </StatRow>
          </>
        )}
      </ScrollView>
    </View>
  );
}
