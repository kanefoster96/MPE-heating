import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/screen-header";
import { Bars, Stat, StatRow } from "@/components/stat";
import { AppText, Card, LoadError, SecondaryButton, Skeleton } from "@/components/ui";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { colors } from "@/lib/theme";
import type { StaffFinance } from "@/lib/types";

const PATH = "/api/mobile/staff/finance";

/**
 * Finance (Kanvas Academy's finance screen): what came in each of the last
 * six months, this month against last, what's owed, the plan's regular
 * income and quotes out. As the site recorded it, before Stripe's fees.
 * Last month's numbers can be emailed now (they go on the 1st anyway).
 */
export default function FinanceScreen() {
  const router = useRouter();
  const [data, setData] = useState<StaffFinance | null>(() => readCached<StaffFinance>(PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<StaffFinance>(PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load finance.");
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // "Email me last month's numbers", as on the website's Home.
  async function emailReport() {
    if (emailing) return;
    setEmailing(true);
    try {
      notify("Sent", (await apiPost<{ message: string }>("/api/mobile/staff/finance/report")).message);
    } catch (err) {
      notify("Not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setEmailing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Finance" />
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
        {error && !data ? (
          <LoadError message={error} onRetry={load} />
        ) : !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={90} radius={20} />)
        ) : (
          <>
            <StatRow>
              <Stat label="This month" value={data.thisMonth} sub={`Last month ${data.lastMonth}`} />
              <Stat label="Owed to you" value={data.owed} sub={data.overdue ? `${data.overdue} overdue` : `${data.unpaid} unpaid`} tone={data.overdue ? "alert" : "plain"} />
            </StatRow>
            <StatRow>
              <Stat label="Plan, a month" value={data.planMonthly} sub={`${data.planMembers} member${data.planMembers === 1 ? "" : "s"}`} tone={data.planMembers ? "good" : "plain"} />
              <Stat label="Quotes out" value={data.quotesOut} sub={`${data.quotesOpen} open`} />
            </StatRow>
            <Card style={{ gap: 14, marginTop: 6 }}>
              <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
                Taken, month by month
              </AppText>
              <Bars rows={data.months.map((m) => ({ label: m.label, value: m.takenPence, display: m.taken }))} highlight={data.months.length - 1} />
              <AppText style={{ color: colors.text2, fontSize: 12, lineHeight: 17 }}>
                Invoices, call-out fees and monthly payments, as the site recorded them, before Stripe&apos;s fees. Maintenance plan payments aren&apos;t included: those are in Stripe.
              </AppText>
            </Card>
            <SecondaryButton title="Invoices" icon="receipt" onPress={() => router.push("/invoices")} />
            <SecondaryButton title={emailing ? "Sending…" : "Email me last month's numbers"} icon="mail" onPress={emailReport} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
