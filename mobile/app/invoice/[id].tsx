import { useCallback, useState, type ComponentProps } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { reportSend, type WhatsAppHandoff } from "@/lib/whatsapp-handoff";
import { openInApp } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";
import type { SheetContext } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Detail = {
  id: string;
  number: string;
  description: string;
  customer: { id: string; name: string } | null;
  appointmentId: string | null;
  created: string;
  lines: { description: string; amount: string }[];
  total: string;
  status: "open" | "paid" | "cancelled";
  paid: string | null;
  left: string | null;
  parts: { when: string; amount: string; via: string | null }[];
  monthly: { status: string; next: string | null; monthly: string | null } | null;
  reminders: number;
  link: string;
  canCancel: boolean;
};

function Row({ icon, label, onPress, tone, last }: { icon: IconName; label: string; onPress: () => void; tone?: "danger"; last?: boolean }) {
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

export default function InvoiceScreen() {
  return (
    <TapToPayProvider>
      <Invoice />
    </TapToPayProvider>
  );
}

/**
 * One invoice or call-out fee (the website's take-payment page for it, in
 * the app): its lines and total, what's been paid and what's left, then
 * Take payment (the Payment sheet), send the link or the receipt again,
 * cancel, and for one paid monthly, record a payment taken in person, or
 * stop or restart the payments.
 */
function Invoice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<SheetContext | null>(null);
  const [record, setRecord] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await apiFetch<Detail>(`/api/mobile/staff/invoices/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that invoice.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  async function act(action: string, amountPence?: number) {
    try {
      const res = await apiPost<{ message: string; whatsapp?: WhatsAppHandoff | null }>(`/api/mobile/staff/invoices/${id}`, { action, amountPence });
      haptic.success();
      setRecord(null);
      load();
      await reportSend("Done", res);
    } catch (err) {
      haptic.warning();
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function openSheet() {
    try {
      setSheet(await apiFetch<SheetContext>(`/api/mobile/staff/payments/${id}`));
    } catch (err) {
      notify("Couldn't open that", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const onMonthly = !!d?.monthly && (d.monthly.status === "active" || d.monthly.status === "past_due");
  const takeable = d?.status === "open" && !onMonthly;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={d?.number ?? "Invoice"} />
      {error && !d ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !d ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={260} radius={20} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: takeable ? 120 : 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
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
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <AppText weight="extrabold" style={{ fontSize: 20 }}>
                  {d.customer?.name ?? "No customer"}
                </AppText>
                <AppText style={{ color: colors.text2, fontSize: 14 }}>
                  {d.description} · {d.created}
                </AppText>
              </View>
              <View style={{ backgroundColor: d.status === "paid" ? "#e5f3ea" : d.status === "cancelled" ? colors.grey : colors.orangeLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <AppText weight="bold" style={{ fontSize: 12, color: d.status === "paid" ? colors.success : d.status === "cancelled" ? colors.text2 : colors.orangeDeep }}>
                  {d.status === "paid" ? "Paid" : d.status === "cancelled" ? "Cancelled" : onMonthly ? "Paying monthly" : "To pay"}
                </AppText>
              </View>
            </View>
            {d.lines.map((l, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.edge }}>
                <AppText style={{ flex: 1, fontSize: 15 }}>{l.description}</AppText>
                <AppText weight="semibold" style={{ fontSize: 15 }}>
                  {l.amount}
                </AppText>
              </View>
            ))}
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.edge, paddingTop: 8 }}>
              <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                Total
              </AppText>
              <AppText weight="extrabold" style={{ fontSize: 20 }}>
                {d.total}
              </AppText>
            </View>
            {d.paid && <AppText style={{ color: colors.success, fontSize: 14 }}>{d.paid}</AppText>}
            {d.parts.length > 0 && (
              <View style={{ gap: 4 }}>
                {d.parts.map((p, i) => (
                  <AppText key={i} style={{ color: colors.text2, fontSize: 14 }}>
                    {p.when} · {p.amount}
                    {p.via ? ` ${p.via}` : ""}
                  </AppText>
                ))}
                {d.left && (
                  <AppText weight="bold" style={{ fontSize: 15 }}>
                    {d.left} left to pay
                  </AppText>
                )}
              </View>
            )}
            {d.monthly && (
              <AppText style={{ color: d.monthly.status === "past_due" ? colors.danger : colors.text2, fontSize: 14 }}>
                {d.monthly.status === "past_due" ? "Their last monthly payment failed. " : d.monthly.status === "stopped" ? "Monthly payments stopped. " : ""}
                {d.monthly.next ? `Next: ${d.monthly.next}.` : ""}
              </AppText>
            )}
          </Card>

          {record !== null && (
            <Card style={{ gap: 10 }}>
              <AppText weight="bold" style={{ fontSize: 15 }}>
                A payment you took
              </AppText>
              <TextInput value={record} onChangeText={setRecord} keyboardType="decimal-pad" placeholder="£" placeholderTextColor={colors.text3} autoFocus accessibilityLabel="Amount in pounds" style={{ height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 14, fontSize: 18, fontFamily: fonts.bold, color: colors.navy }} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(
                  [
                    ["monthly_cash", "Cash"],
                    ["monthly_bank_transfer", "Bank"],
                    ["monthly_in_person", "Card"],
                  ] as const
                ).map(([action, label]) => (
                  <PressableScale key={action} onPress={() => act(action, Math.round(Number(record.replace(/[£,\s]/g, "")) * 100))} accessibilityLabel={`Record it as ${label}`} style={{ flex: 1 }}>
                    <View style={{ height: 46, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                      <AppText weight="bold" style={{ color: "#fff" }}>
                        {label}
                      </AppText>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </Card>
          )}

          <Card style={{ paddingVertical: 0, overflow: "hidden" }}>
            <View style={{ marginBottom: -1 }}>
            {d.customer && <Row icon="person-outline" label="Their details" onPress={() => router.push(`/customer/${d.customer!.id}`)} />}
            {d.appointmentId && <Row icon="construct-outline" label="The job" onPress={() => router.push(`/job/${d.appointmentId}`)} />}
            <Row icon="eye-outline" label={d.status === "paid" ? "See their receipt" : "See what they see"} onPress={() => openInApp(d.link)} />
            {d.status === "open" && !onMonthly && <Row icon="paper-plane-outline" label="Send the payment link again" onPress={() => act("resend")} />}
            {d.status === "paid" && <Row icon="receipt-outline" label="Send the receipt again" onPress={() => act("receipt")} />}
            {onMonthly && <Row icon="cash-outline" label="Record a payment you took" onPress={() => setRecord("")} />}
            {onMonthly && (
              <Row
                icon="pause-circle-outline"
                label="Stop the monthly payments"
                onPress={async () => {
                  if (await confirmAction("Stop the monthly payments?", "No more dates. Anything left can still be paid off.", "Stop them")) act("stop_monthly");
                }}
              />
            )}
            {d.monthly?.status === "stopped" && d.status === "open" && <Row icon="play-circle-outline" label="Restart the monthly payments" onPress={() => act("restart_monthly")} />}
            {d.canCancel && (
              <Row
                icon="close-circle-outline"
                label="Cancel this invoice"
                tone="danger"
                last
                onPress={async () => {
                  if (await confirmAction("Cancel this invoice?", "It can't be paid after this. The customer isn't messaged.", "Cancel it")) act("cancel");
                }}
              />
            )}
            </View>
          </Card>
        </ScrollView>
      )}
      {takeable && d && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
          <PrimaryButton title={`Take payment, ${d.left ?? d.total}`} icon="card" onPress={openSheet} />
        </View>
      )}
      {sheet && (
        <PaymentSheet
          visible
          context={sheet}
          onClose={() => setSheet(null)}
          onDone={async () => {
            await load();
            try {
              setSheet(await apiFetch<SheetContext>(`/api/mobile/staff/payments/${id}`));
            } catch {
              setSheet(null);
            }
          }}
        />
      )}
    </View>
  );
}
