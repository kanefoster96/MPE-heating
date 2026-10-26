import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { RowSkeleton } from "@/components/rows";
import { AppText, Card, LoadError, PressableScale, SecondaryButton } from "@/components/ui";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider, useTapToPay } from "@/components/tap-to-pay";
import { apiFetch } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { SheetContext } from "@/lib/types";

type OpenPayment = { id: string; number: string; description: string; amount: string; amountPence: number; paidSoFar: string | null; customer: string | null; createdAt: string };
type PaymentsResponse = { on: boolean; terminalLocation: string | null; payments: OpenPayment[] };

/**
 * The team's Take payment (their Payment tab): every open invoice and
 * call-out fee. Tapping one opens the Payment sheet: Tap to Pay or a card
 * reader, their saved card, the link, or cash (all or part). For one job,
 * the job's own page has a Payment button (app/job/[id].tsx).
 */
export default function TakePaymentScreen() {
  return (
    <TapToPayProvider>
      <TakePayment />
    </TapToPayProvider>
  );
}

function TakePayment() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; context: SheetContext } | null>(null);
  const tap = useTapToPay(data?.terminalLocation ?? null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<PaymentsResponse>("/api/mobile/staff/payments"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load payments.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = useCallback(
    async (id: string) => {
      setOpening(id);
      try {
        setSheet({ id, context: await apiFetch<SheetContext>(`/api/mobile/staff/payments/${id}`) });
      } catch (err) {
        notify("Couldn't open that", err instanceof Error ? err.message : "Please try again.");
        load();
      } finally {
        setOpening(null);
      }
    },
    [load],
  );

  // After a payment: the list, and the sheet if it's still open (part paid).
  const refresh = useCallback(async () => {
    await load();
    if (!sheet) return;
    try {
      setSheet({ id: sheet.id, context: await apiFetch<SheetContext>(`/api/mobile/staff/payments/${sheet.id}`) });
    } catch {
      setSheet(null);
    }
  }, [load, sheet]);

  const header = (
    <View style={{ gap: 12, marginBottom: 6 }}>
      <Card style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="phone-portrait" size={24} color={colors.orangeDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 16 }}>
            Tap to Pay or card reader
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19 }}>
            {tap.supported ? "Pick a payment, then they tap their card or phone on yours, or use the card reader." : "Works in the full MPE app on your phone, once it's set up."}
          </AppText>
        </View>
      </Card>
      <SecondaryButton title="New payment" icon="add" onPress={() => openSignedIn("/staff/payments/new")} />
      <AppText weight="bold" style={{ color: colors.text3, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6, marginLeft: 4 }}>
        Waiting to be paid
      </AppText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Take payment" />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : !data.on ? (
        <View style={{ padding: 20 }}>
          <Card style={{ gap: 6 }}>
            <AppText weight="bold" style={{ fontSize: 17 }}>
              Payments aren&apos;t switched on yet
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>They start once Stripe is connected to the website (docs/setup-checklist.md).</AppText>
          </Card>
        </View>
      ) : (
        <FlatList
          data={data.payments}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={header}
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
          ListEmptyComponent={<AppText style={{ color: colors.text2, textAlign: "center", marginTop: 24 }}>Nothing waiting to be paid.</AppText>}
          renderItem={({ item }) => (
            <PressableScale onPress={() => (opening ? undefined : open(item.id))} accessibilityLabel={`${item.customer ?? "Customer"}, ${item.number}, ${item.amount} to pay. Take payment`}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 16 }}>
                    {item.customer ?? "Customer"}
                  </AppText>
                  <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 2 }} numberOfLines={2}>
                    {item.number}: {item.description}
                  </AppText>
                  {item.paidSoFar && (
                    <AppText weight="semibold" style={{ color: colors.success, fontSize: 13, marginTop: 2 }}>
                      {item.paidSoFar} paid so far
                    </AppText>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <AppText weight="extrabold" style={{ fontSize: 20 }}>
                    {item.amount}
                  </AppText>
                  <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 13 }}>
                    {opening === item.id ? "Opening…" : "Take it ›"}
                  </AppText>
                </View>
              </Card>
            </PressableScale>
          )}
        />
      )}
      {sheet && <PaymentSheet visible context={sheet.context} onClose={() => setSheet(null)} onDone={refresh} />}
    </View>
  );
}
