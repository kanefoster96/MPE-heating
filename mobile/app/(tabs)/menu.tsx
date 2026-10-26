import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MenuCard } from "@/components/menu-card";
import { NavList, NavRow } from "@/components/nav-row";
import { AppText, FadeIn, LoadError, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { MenuCard as Card, StaffOverview } from "@/lib/types";

const PATH = "/api/mobile/staff/overview";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
}

/**
 * The team's Menu (Kanvas Academy's admin menu): everything that runs MPE
 * in one place. Cards up top turn orange when something needs him (a
 * request, an unread message, an overdue invoice, a failed monthly or plan
 * payment, a quote accepted and not booked in, a certificate running out)
 * and green when it's in order. Then every tool, the app's own screens and
 * the website's pages opened signed in. Money is for admins only.
 */
export default function MenuTab() {
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<StaffOverview | null>(() => readCached<StaffOverview>(PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<StaffOverview>(PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the menu.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  // Only the team: once we know who's signed in (not before, or it'd bounce while loading).
  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const open = (card: Card) => (card.route ? router.push(card.route as never) : card.path ? openSignedIn(card.path) : undefined);
  const badge = (id: string) => data?.cards.find((x) => x.id === id)?.count ?? 0;
  const pairs: Card[][] = [];
  for (let i = 0; i < (data?.cards.length ?? 0); i += 2) pairs.push(data!.cards.slice(i, i + 2));
  const first = data?.name?.split(" ")[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
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
      <View style={{ paddingHorizontal: 4, marginBottom: 4 }}>
        <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, letterSpacing: -0.5 }}>
          {first && !first.includes("@") ? `${greeting()}, ${first}` : greeting()}
        </AppText>
        {data ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Ionicons name={data.attention ? "alert-circle" : "checkmark-circle"} size={18} color={data.attention ? colors.orangeDeep : colors.success} />
            <AppText weight="semibold" style={{ color: data.attention ? colors.orangeDeep : colors.success, fontSize: 15 }}>
              {data.attention ? `${data.attention} thing${data.attention === 1 ? "" : "s"} need${data.attention === 1 ? "s" : ""} you` : "All in order"}
            </AppText>
          </View>
        ) : (
          <AppText style={{ color: colors.text2, fontSize: 15, marginTop: 4 }}>Everything you need to run MPE.</AppText>
        )}
      </View>

      {error && !data ? (
        <LoadError message={error} onRetry={load} />
      ) : !data ? (
        [0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 12 }}>
            {[0, 1].map((c) => (
              <View key={c} style={{ flex: 1, minHeight: 138, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, padding: 14, gap: 10 }}>
                <Skeleton width={36} height={36} radius={12} />
                <Skeleton width="60%" height={12} radius={6} />
                <Skeleton width="45%" height={22} radius={8} />
              </View>
            ))}
          </View>
        ))
      ) : (
        pairs.map((pair, i) => (
          <FadeIn key={pair[0].id} index={i}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {pair.map((card) => (
                <MenuCard key={card.id} card={card} onPress={() => open(card)} />
              ))}
              {pair.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          </FadeIn>
        ))
      )}

      <View style={{ height: 8 }} />
      <NavList title="Jobs and customers">
        <NavRow icon="calendar-outline" title="Calendar" description="The month, the week, and adding visits." onPress={() => router.push("/calendar")} />
        <NavRow icon="clipboard-outline" title="Today's jobs" description="Who, where, on my way, finish." onPress={() => router.push("/jobs")} />
        <NavRow icon="time-outline" title="Requests" description="New bookings and visits to book in." badge={badge("requests")} onPress={() => router.push("/notifications")} />
        <NavRow icon="chatbubbles-outline" title="Messages" description="Every customer's chat, texts and emails." badge={badge("messages")} onPress={() => router.push("/chat")} />
        <NavRow icon="people-outline" title="Customers" description="Details, boilers, notes, history." onPress={() => openSignedIn("/staff/customers")} />
        <NavRow icon="shield-checkmark-outline" title="Certificates" description="Gas safety and electrical, running out soon." badge={badge("certificates")} onPress={() => router.push("/certificates")} last={!data?.admin} />
        {data?.admin ? <NavRow icon="sunny-outline" title="Days off" description="Holidays that block bookings." onPress={() => openSignedIn("/staff/days-off")} last /> : null}
      </NavList>

      {data?.admin ? (
        <>
          <NavList title="Money">
            <NavRow icon="card-outline" title="Take payment" description="Tap to Pay, or any open invoice." onPress={() => router.push("/take-payment")} />
            <NavRow icon="add-circle-outline" title="New invoice" description="An invoice or call-out fee, sent or paid now." onPress={() => router.push("/new-payment")} />
            <NavRow icon="receipt-outline" title="Invoices" description="Unpaid, overdue, paid monthly, receipts." badge={badge("invoices") || badge("monthly")} onPress={() => router.push("/invoices")} />
            <NavRow icon="document-text-outline" title="Quotes" description="Out with customers, accepted, to invoice." badge={badge("quotes")} onPress={() => router.push("/quotes")} />
            <NavRow icon="create-outline" title="New quote" description="Lines, deposit, monthly payments." onPress={() => router.push("/new-quote")} />
            <NavRow icon="refresh-circle-outline" title="Maintenance plan" description="Members, payments, who's leaving." badge={badge("plan")} onPress={() => openSignedIn("/staff/plan")} last />
          </NavList>

          <NavList title="Numbers">
            <NavRow icon="cash-outline" title="Finance" description="What came in, month by month, and what's owed." onPress={() => router.push("/finance")} />
            <NavRow icon="trending-up-outline" title="Metrics" description="Jobs, where they came from, quotes won, reviews." onPress={() => router.push("/metrics")} />
            <NavRow icon="speedometer-outline" title="Dashboard" description="The website's full overview." onPress={() => openSignedIn("/staff")} last />
          </NavList>

          <NavList title="Settings">
            <NavRow icon="settings-outline" title="Settings" description="Plan prices, the team, and more." onPress={() => openSignedIn("/staff/settings")} last />
          </NavList>
        </>
      ) : null}
    </ScrollView>
  );
}
