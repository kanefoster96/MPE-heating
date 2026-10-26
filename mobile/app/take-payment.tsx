import { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { RowSkeleton } from "@/components/rows";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, SecondaryButton, haptic } from "@/components/ui";
import { TapToPayProvider, useTapToPay } from "@/components/tap-to-pay";
import { apiFetch } from "@/lib/api";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";

type OpenPayment = { id: string; number: string; description: string; amount: string; amountPence: number; customer: string | null; createdAt: string };
type PaymentsResponse = { on: boolean; terminalLocation: string | null; payments: OpenPayment[] };

/**
 * The team's Take payment (the orange button in the middle, for them):
 * every open invoice and call-out fee, and Tap to Pay to take it on this
 * phone. A new payment is made on the website's take-payment page, which
 * opens here signed in; it then shows in this list.
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
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function takeIt(p: OpenPayment) {
    setBusyId(p.id);
    const result = await tap.take(p.id);
    setBusyId(null);
    if (result.ok) {
      haptic.success();
      Alert.alert("Paid", `${p.amount} taken${p.customer ? ` from ${p.customer}` : ""}. We'll send their receipt.`);
      // The webhook marks it paid a moment later.
      setTimeout(load, 2500);
    } else if (!result.cancelled) {
      haptic.warning();
      Alert.alert("Not taken", result.message);
    }
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 6 }}>
      <Card style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="phone-portrait" size={24} color={colors.orangeDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 16 }}>
            Tap to Pay
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19 }}>
            {tap.supported ? "Pick a payment, then the customer taps their card or phone on the back of yours." : "Works in the full MPE app on your phone, once Tap to Pay is set up."}
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
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 16 }}>
                    {item.customer ?? "Customer"}
                  </AppText>
                  <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 2 }} numberOfLines={2}>
                    {item.number}: {item.description}
                  </AppText>
                </View>
                <AppText weight="extrabold" style={{ fontSize: 22 }}>
                  {item.amount}
                </AppText>
              </View>
              {tap.supported && (
                <PrimaryButton title={busyId === item.id ? "Hold the card to your phone…" : `Tap to Pay ${item.amount}`} icon="wifi" size="medium" onPress={() => (busyId ? undefined : takeIt(item))} />
              )}
              <PressableScale onPress={() => openSignedIn("/staff/invoices")} accessibilityLabel="Other ways to take it" style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
                  Cash, bank transfer or a card on file
                </AppText>
              </PressableScale>
            </Card>
          )}
        />
      )}
    </View>
  );
}
