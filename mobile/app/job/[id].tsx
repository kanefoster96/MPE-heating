import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { StaffJobCard } from "@/components/staff-job";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, LoadError, PrimaryButton, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { JobPayment, SheetContext, StaffJobDetail } from "@/lib/types";

/**
 * One of the team's jobs, opened from Jobs or Home: the visit with its
 * buttons, what's been asked for it and paid, and the customer's other open
 * invoices. Payment, stuck to the bottom, takes it (components/payment-sheet.tsx).
 */
export default function JobScreen() {
  return (
    <TapToPayProvider>
      <Job />
    </TapToPayProvider>
  );
}

function PaymentRow({ p, last }: { p: JobPayment; last: boolean }) {
  const paid = p.status === "paid";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" style={{ fontSize: 15 }} numberOfLines={1}>
          {p.kind === "callout_fee" ? "Call-out fee" : p.description}
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 13 }}>
          {p.number}
          {p.job !== "this" ? (p.job === "none" ? " · Not on a job yet" : ` · From the ${p.job} visit`) : ""}
          {p.monthly ? " · Paying monthly" : ""}
        </AppText>
        {p.paidSoFar && (
          <AppText weight="semibold" style={{ color: colors.success, fontSize: 13 }}>
            {p.paidSoFar} paid of {p.total}
          </AppText>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <AppText weight="extrabold" style={{ fontSize: 16 }}>
          {p.amount}
        </AppText>
        <AppText weight="bold" style={{ fontSize: 12, color: paid ? colors.success : colors.orangeDeep }}>
          {paid ? `Paid${p.paidVia ? `, ${p.paidVia}` : ""}` : p.paidSoFar ? "Left to pay" : "Waiting"}
        </AppText>
      </View>
    </View>
  );
}

function Job() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const path = `/api/mobile/staff/jobs/${id}`;
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<StaffJobDetail | null>(() => readCached<StaffJobDetail>(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<StaffJobDetail>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the job.");
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  // "Take payment" on a finished job's card opens the sheet straight away.
  useEffect(() => {
    if (pay && data) setSheet(true);
    // Once, when the job first loads.
  }, [pay, !!data]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const title = data ? `${data.dayLabel}, ${data.job.window.split("–")[0]}` : "Job";
  const open = data ? data.payments.forJob.filter((p) => p.status === "open") : [];
  const sheetContext: SheetContext | null = data
    ? {
        jobId: data.job.id,
        customerName: data.job.customer?.name ?? null,
        on: data.payments.on,
        terminalLocation: data.payments.terminalLocation,
        savedCard: data.payments.savedCard,
        choices: [...data.payments.forJob, ...data.payments.otherOpen],
      }
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={title} />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={260} radius={22} />
          <Skeleton height={120} radius={22} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
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
            <StaffJobCard job={data.job} day={data.day} onChanged={load} onPay={() => setSheet(true)} />

            <Card style={{ paddingVertical: 6 }}>
              <AppText weight="bold" style={{ fontSize: 17, paddingVertical: 8 }}>
                Payments for this job
              </AppText>
              {data.payments.forJob.length ? (
                data.payments.forJob.map((p, i) => <PaymentRow key={p.id} p={p} last={i === data.payments.forJob.length - 1} />)
              ) : (
                <AppText style={{ color: colors.text2, fontSize: 14, paddingBottom: 10 }}>Nothing asked for yet.</AppText>
              )}
            </Card>

            {data.payments.otherOpen.length > 0 && (
              <Card style={{ paddingVertical: 6 }}>
                <AppText weight="bold" style={{ fontSize: 17, paddingTop: 8 }}>
                  {data.job.customer?.name ? `${data.job.customer.name.split(" ")[0]}'s other unpaid invoices` : "Other unpaid invoices"}
                </AppText>
                <AppText style={{ color: colors.text2, fontSize: 13, paddingBottom: 4 }}>Pick one under Payment to take it with this job.</AppText>
                {data.payments.otherOpen.map((p, i) => (
                  <PaymentRow key={p.id} p={p} last={i === data.payments.otherOpen.length - 1} />
                ))}
              </Card>
            )}
          </ScrollView>

          {data.job.customer && (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
              <PrimaryButton title={open.length === 1 ? `Payment, ${open[0].amount}` : "Payment"} icon="card" onPress={() => setSheet(true)} />
            </View>
          )}
          {sheetContext && <PaymentSheet visible={sheet} context={sheetContext} onClose={() => setSheet(false)} onDone={load} />}
        </>
      )}
    </View>
  );
}
