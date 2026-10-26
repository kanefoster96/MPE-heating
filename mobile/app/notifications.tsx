import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { RowSkeleton } from "@/components/rows";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch } from "@/lib/api";
import { openInApp, openSignedIn } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors } from "@/lib/theme";
import type { AppNotice } from "@/lib/types";

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The bell. For a customer: anything waiting on them first (an invoice to
 * pay, a quote, a plan payment that failed), then what's coming up. For
 * the team: new bookings and requests waiting on an answer. Built fresh
 * from their records each time (src/lib/app-notifications.ts on the site).
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { signedIn, staff, refreshMe } = useAuth();
  const [notices, setNotices] = useState<AppNotice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!signedIn) return;
    setError(null);
    try {
      setNotices((await apiFetch<{ notices: AppNotice[] }>("/api/mobile/notifications")).notices);
      refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load these.");
    }
  }, [signedIn, refreshMe]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function open(n: AppNotice) {
    if (n.route) router.push(n.route as never);
    else if (n.url?.startsWith(`${SITE_URL}/staff`) || n.url?.startsWith(`${SITE_URL}/account`)) openSignedIn(n.url.slice(SITE_URL.length));
    else if (n.url) openInApp(n.url);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={staff ? "Requests" : "Notifications"} />
      {!signedIn ? (
        <View style={{ padding: 20 }}>
          <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="notifications" size={30} color={colors.orangeDeep} />
            </View>
            <AppText weight="bold" style={{ fontSize: 20, marginTop: 4, textAlign: "center" }}>
              Your visits, quotes and invoices
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21, textAlign: "center" }}>
              Sign in with the email you booked with and they&apos;ll show here, with anything waiting on you.
            </AppText>
            <View style={{ alignSelf: "stretch", marginTop: 10 }}>
              <PrimaryButton title="Sign in" icon="person" size="medium" onPress={() => router.push("/sign-in")} />
            </View>
          </Card>
        </View>
      ) : error && !notices ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !notices ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
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
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60, gap: 8 }}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <AppText weight="semibold" style={{ fontSize: 17 }}>
                {staff ? "Nothing waiting" : "You're all up to date"}
              </AppText>
              <AppText style={{ color: colors.text2, textAlign: "center" }}>{staff ? "New bookings and requests show here." : "Visits, quotes and invoices show here."}</AppText>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <PressableScale onPress={() => open(item)} accessibilityLabel={`${item.title}. ${item.text}`}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: item.action ? colors.orangeDeep : colors.edge, padding: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: item.action ? colors.orangeLight : colors.grey, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon} size={22} color={item.action ? colors.orangeDeep : colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }}>
                      {item.title}
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 2 }} numberOfLines={2}>
                      {item.text}
                    </AppText>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <AppText style={{ color: colors.text3, fontSize: 12 }}>{when(item.at)}</AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                  </View>
                </View>
              </PressableScale>
            </FadeIn>
          )}
        />
      )}
    </View>
  );
}
