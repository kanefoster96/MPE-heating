import { useCallback, useState, type ComponentProps } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, Card, LoadError, PressableScale, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { reportSend, type WhatsAppHandoff } from "@/lib/whatsapp-handoff";
import { openInApp } from "@/lib/open-link";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Detail = {
  id: string;
  number: string;
  title: string;
  status: string;
  statusLabel: string;
  customer: { id: string; name: string } | null;
  lines: { description: string; amount: string }[];
  total: string;
  deposit: string | null;
  details: string | null;
  validUntil: string;
  timeline: string[];
  payments: { id: string; label: string; amount: string; status: string }[];
  canResend: boolean;
  canCancel: boolean;
  toDo: boolean;
  link: string;
};

function Row({ icon, label, onPress, tone, last }: { icon: IconName; label: string; onPress: () => void; tone?: "danger" | "orange"; last?: boolean }) {
  const ink = tone === "danger" ? colors.danger : tone === "orange" ? colors.orangeDeep : colors.navy;
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

/**
 * One quote (the website's, in the app): what was sent, where it's got
 * to (sent, opened, followed up, accepted with the deposit, or declined
 * and why), and what's next: send it again, withdraw it, book the work in,
 * or invoice the rest once it's done.
 */
export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await apiFetch<Detail>(`/api/mobile/staff/quotes/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that quote.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  async function act(action: string) {
    try {
      const res = await apiPost<{ message: string; whatsapp?: WhatsAppHandoff | null }>(`/api/mobile/staff/quotes/${id}`, { action });
      haptic.success();
      load();
      await reportSend("Done", res);
    } catch (err) {
      haptic.warning();
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={d ? `Quote ${d.number}` : "Quote"} />
      {error && !d ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !d ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={280} radius={20} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
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
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <AppText weight="extrabold" style={{ fontSize: 20 }}>
                  {d.title}
                </AppText>
                <AppText style={{ color: colors.text2, fontSize: 14 }}>
                  {d.customer?.name ?? "Customer"} · open until {d.validUntil.replace(/^\w+ /, "")}
                </AppText>
              </View>
              <View style={{ backgroundColor: d.status === "accepted" ? "#e5f3ea" : d.status === "sent" ? colors.orangeLight : colors.grey, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <AppText weight="bold" style={{ fontSize: 12, color: d.status === "accepted" ? colors.success : d.status === "sent" ? colors.orangeDeep : colors.text2 }}>
                  {d.statusLabel}
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
            {d.deposit && <AppText style={{ color: colors.text2, fontSize: 14 }}>{d.deposit}</AppText>}
            {d.details && <AppText style={{ fontSize: 14, lineHeight: 20 }}>{d.details}</AppText>}
          </Card>

          {d.timeline.length > 0 && (
            <Card style={{ gap: 6 }}>
              {d.timeline.map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === d.timeline.length - 1 ? colors.orangeDeep : colors.text3 }} />
                  <AppText style={{ fontSize: 14 }}>{t}</AppText>
                </View>
              ))}
            </Card>
          )}

          {d.payments.length > 0 && (
            <Card style={{ gap: 8 }}>
              {d.payments.map((p) => (
                <PressableScale key={p.id} onPress={() => router.push(`/invoice/${p.id}`)} accessibilityLabel={`${p.label}, ${p.amount}, ${p.status}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                    <AppText weight="semibold" style={{ flex: 1, fontSize: 15 }}>
                      {p.label} {p.amount}
                    </AppText>
                    <AppText weight="bold" style={{ fontSize: 13, color: p.status === "Paid" ? colors.success : colors.orangeDeep }}>
                      {p.status}
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                  </View>
                </PressableScale>
              ))}
            </Card>
          )}

          <Card style={{ paddingVertical: 0, overflow: "hidden" }}>
            <View style={{ marginBottom: -1 }}>
              {d.toDo && d.customer && <Row icon="calendar" label="Book the work in" tone="orange" onPress={() => router.push(`/visit-form?customer=${d.customer!.id}`)} />}
              {d.toDo && (
                <Row
                  icon="receipt-outline"
                  label="Invoice the rest (the work's done)"
                  onPress={async () => {
                    if (await confirmAction("Invoice the rest?", "Sends them the invoice for what's left after the deposit.", "Send it")) act("invoice");
                  }}
                />
              )}
              {d.customer && <Row icon="person-outline" label="Their details" onPress={() => router.push(`/customer/${d.customer!.id}`)} />}
              <Row icon="eye-outline" label="See what they see" onPress={() => openInApp(d.link)} />
              {d.canResend && <Row icon="paper-plane-outline" label="Send it again" onPress={() => act("resend")} />}
              {d.canCancel && (
                <Row
                  icon="close-circle-outline"
                  label="Withdraw the quote"
                  tone="danger"
                  onPress={async () => {
                    if (await confirmAction("Withdraw this quote?", "They can't accept it after this.", "Withdraw")) act("cancel");
                  }}
                />
              )}
            </View>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}
