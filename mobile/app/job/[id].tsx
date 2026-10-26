import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { StaffJobCard } from "@/components/staff-job";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
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

type IconName = ComponentProps<typeof Ionicons>["name"];

function Pill({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 }}>
        <Ionicons name={icon} size={18} color={colors.navy} />
        <AppText weight="bold" style={{ fontSize: 14 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

function ActionRow({ icon, label, onPress, tone, last }: { icon: IconName; label: string; onPress: () => void; tone?: "danger"; last?: boolean }) {
  const ink = tone === "danger" ? colors.danger : colors.navy;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
        <Ionicons name={icon} size={20} color={ink} />
        <AppText weight="semibold" style={{ flex: 1, fontSize: 15, color: ink }}>
          {label}
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={colors.text3} />
      </View>
    </PressableScale>
  );
}

function Job() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const path = `/api/mobile/staff/jobs/${id}`;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<StaffJobDetail | null>(() => readCached<StaffJobDetail>(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string) {
    if (!data || busy) return false;
    setBusy(action);
    try {
      const res = await apiPost<{ message: string }>("/api/mobile/staff/schedule/visit/action", { id: data.job.id, action });
      haptic.success();
      notify("Done", res.message);
      if (action === "remove") router.back();
      else load();
      return true;
    } catch (err) {
      haptic.warning();
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function cancelVisit() {
    if (!data) return;
    if (!(await confirmAction("Cancel this visit?", "It stays on their history as cancelled.", "Cancel it"))) return;
    const name = data.job.customer?.name?.split(" ")[0];
    const tell = data.job.customer && data.job.status !== "requested" ? await confirmAction(`Tell ${name ?? "them"}?`, "They're sent a message that it's cancelled, by text, email and their chat.", "Tell them") : false;
    await act(tell ? "cancel" : "cancel_quietly");
  }

  async function removeVisit() {
    if (!data) return;
    if (await confirmAction("Remove this visit?", "It's taken off the calendar altogether. Nobody's told. To let them know, cancel it instead.", "Remove")) await act("remove");
  }

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
        quoteToBill: data.quoteToBill ?? null,
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

            {/* A request to answer: as they asked, or another time. */}
            {data.asked && (
              <Card style={{ gap: 10, borderColor: colors.orangeDeep }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  They asked for {data.asked}
                </AppText>
                {data.askedPast ? (
                  <>
                    <AppText style={{ color: colors.text2, fontSize: 14 }}>That day&apos;s gone without it being booked. Pick a new time and they&apos;ll be told.</AppText>
                    <PrimaryButton title="Pick a new time" icon="calendar" size="medium" onPress={() => router.push(`/visit-form?id=${data.job.id}`)} />
                  </>
                ) : (
                  <>
                    <PrimaryButton title={busy === "accept" ? "Booking…" : "Book it as they asked"} icon="checkmark" size="medium" onPress={() => act("accept")} />
                    <Pill icon="calendar-outline" label="Pick another time" onPress={() => router.push(`/visit-form?id=${data.job.id}`)} />
                  </>
                )}
              </Card>
            )}
            {data.change && (
              <Card style={{ gap: 10, borderColor: colors.orangeDeep }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  They asked to move it to {data.change.label}
                </AppText>
                {data.change.note ? <AppText style={{ color: colors.text2, fontSize: 14 }}>&ldquo;{data.change.note}&rdquo;</AppText> : null}
                <PrimaryButton title="Move it" icon="calendar" size="medium" onPress={() => router.push(`/visit-form?id=${data.job.id}&usechange=1`)} />
                <Pill icon="checkmark-outline" label={busy === "keep" ? "Saving…" : "Keep this time"} onPress={() => act("keep")} />
              </Card>
            )}

            {/* Not fixed first time: coming back, and the return visit (book it, or open it). */}
            {data.comingBack && (
              <Card style={{ gap: 10, borderColor: data.comingBack.returnVisit ? colors.edge : colors.orangeDeep }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  Coming back{data.comingBack.note ? ` to ${data.comingBack.note.replace(/\.$/, "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}` : ""}
                </AppText>
                {data.comingBack.returnVisit ? (
                  <View style={{ flexDirection: "row" }}>
                    <Pill icon="calendar-outline" label={`Return visit: ${data.comingBack.returnVisit.when}`} onPress={() => router.push(`/job/${data.comingBack!.returnVisit!.id}`)} />
                  </View>
                ) : (
                  <>
                    <PrimaryButton title="Book the return visit" icon="calendar" size="medium" onPress={() => router.push(`/visit-form?followUp=${data.job.id}`)} />
                    <View style={{ flexDirection: "row" }}>
                      <Pill icon="document-text-outline" label="Send the repair price" onPress={() => router.push(`/new-quote?visit=${data.job.id}`)} />
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <Pill
                        icon="close-circle-outline"
                        label={busy === "no_return" ? "Saving…" : "Not needed now"}
                        onPress={async () => {
                          if (await confirmAction("No return visit?", "It comes off the list of return visits to book. Nobody's told.", "Not needed")) await act("no_return");
                        }}
                      />
                    </View>
                  </>
                )}
              </Card>
            )}
            {data.firstVisit && (
              <View style={{ flexDirection: "row" }}>
                <Pill icon="return-up-back-outline" label={`Finishes the job from ${data.firstVisit.when}`} onPress={() => router.push(`/job/${data.firstVisit!.id}`)} />
              </View>
            )}

            {/* Move it, change it, or see everything about them. */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {data.job.status !== "done" && <Pill icon="calendar-outline" label="Move or change" onPress={() => router.push(`/visit-form?id=${data.job.id}`)} />}
              {data.customerId && <Pill icon="person-outline" label="Their details" onPress={() => router.push(`/customer/${data.customerId}`)} />}
            </View>

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
            {/* The rest: the details again, back to booked, cancel, remove. */}
            <Card style={{ paddingVertical: 4 }}>
              {data.job.customer && data.job.status !== "requested" && (
                <ActionRow icon="paper-plane-outline" label={busy === "send" ? "Sending…" : "Send them the details again"} onPress={() => act("send")} />
              )}
              {data.job.status === "done" && <ActionRow icon="create-outline" label="What was done, photos and certificates" onPress={() => router.push(`/finish/${data.job.id}`)} />}
              {(data.job.status === "no_access" || data.job.status === "done") && <ActionRow icon="arrow-undo-outline" label="Back to booked" onPress={() => act("booked")} />}
              {data.job.status !== "done" && <ActionRow icon="close-circle-outline" label="Cancel the visit" tone="danger" onPress={cancelVisit} />}
              <ActionRow icon="trash-outline" label="Remove it from the calendar" tone="danger" onPress={removeVisit} last />
            </Card>
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
