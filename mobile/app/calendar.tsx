import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { MonthGrid, type GridDay } from "@/components/month-grid";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { StaffDay, StaffJob } from "@/lib/types";

type Month = { month: string; label: string; today: string; days: (GridDay & { kinds: string[] })[] };

const STATUS: Record<StaffJob["status"], { label: string; bg: string; ink: string }> = {
  requested: { label: "Requested", bg: colors.orangeLight, ink: colors.orangeDeep },
  booked: { label: "Booked", bg: colors.grey, ink: colors.navy },
  done: { label: "Done", bg: "#e5f3ea", ink: colors.success },
  no_access: { label: "Not in", bg: "#fdecec", ink: colors.danger },
  cancelled: { label: "Cancelled", bg: colors.grey, ink: colors.text2 },
};

/**
 * The team's calendar (the website's schedule, in the app): the month with
 * a dot per visit, orange for a request, days off greyed. Pick a day for
 * its visits, each opening its job page (move, cancel, answer a request).
 * "Add a visit" books one in.
 */
export default function CalendarScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [month, setMonth] = useState<string | null>(params.day ? params.day.slice(0, 7) : null);
  const [data, setData] = useState<Month | null>(() => readCached<Month>("/api/mobile/staff/schedule/month?month=") ?? null);
  const [picked, setPicked] = useState<string | null>(params.day ?? null);
  const [day, setDay] = useState<StaffDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadMonth = useCallback(async (m: string | null) => {
    setError(null);
    try {
      const res = await apiFetch<Month>(`/api/mobile/staff/schedule/month?month=${m ?? ""}`);
      setData(res);
      setPicked((p) => p ?? res.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the calendar.");
    }
  }, []);

  const loadDay = useCallback(async (d: string | null) => {
    if (!d) return;
    try {
      setDay(await apiFetch<StaffDay>(`/api/mobile/staff/jobs?day=${d}`));
    } catch {
      setDay(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!staff) return;
      loadMonth(month);
      loadDay(picked);
    }, [staff, month, picked, loadMonth, loadDay]),
  );

  useEffect(() => {
    setDay(null);
  }, [picked]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const shown = data && data.month === (month ?? data.month) ? data : null;
  const dayLabel = picked ? new Date(`${picked}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Calendar" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.orangeDeep}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([loadMonth(month), loadDay(picked)]);
              setRefreshing(false);
            }}
          />
        }
      >
        {error && !data ? (
          <LoadError message={error} onRetry={() => loadMonth(month)} />
        ) : !shown ? (
          <Skeleton height={330} radius={22} />
        ) : (
          <Card style={{ paddingHorizontal: 8, paddingVertical: 10 }}>
            <MonthGrid
              month={shown.month}
              days={shown.days}
              today={shown.today}
              selected={picked}
              onPick={setPicked}
              onMonth={(m) => {
                setMonth(m);
                setData(null);
              }}
            />
          </Card>
        )}

        {picked && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 20, flex: 1 }}>
                {dayLabel}
              </AppText>
              {day && day.closed === false && (
                <AppText style={{ color: colors.text2, fontSize: 14 }}>
                  {day.jobs.length} visit{day.jobs.length === 1 ? "" : "s"}
                </AppText>
              )}
            </View>
            {!day ? (
              <Skeleton height={80} radius={18} />
            ) : day.closed !== false ? (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="sunny" size={22} color={colors.orangeDeep} />
                <AppText weight="semibold">Day off{day.closed ? `: ${day.closed}` : ""}</AppText>
              </Card>
            ) : day.jobs.length === 0 ? (
              <AppText style={{ color: colors.text2, paddingHorizontal: 4 }}>Nothing booked.</AppText>
            ) : (
              day.jobs.map((j, i) => {
                const st = STATUS[j.status];
                return (
                  <FadeIn key={j.id} index={i}>
                    <PressableScale onPress={() => router.push(`/job/${j.id}`)} accessibilityLabel={`${j.window}, ${j.customer?.name ?? j.title ?? "Visit"}, ${j.kind}, ${st.label}`}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: j.changeRequested || j.status === "requested" ? colors.orangeDeep : colors.edge, padding: 14 }}>
                        <View style={{ width: 64 }}>
                          <AppText weight="extrabold" style={{ fontSize: 15 }}>
                            {j.window.split("–")[0]}
                          </AppText>
                          <AppText style={{ color: colors.text3, fontSize: 12 }}>to {j.window.split("–")[1]}</AppText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
                            {j.customer?.name ?? j.title ?? "Visit"}
                          </AppText>
                          <AppText style={{ color: colors.text2, fontSize: 13 }} numberOfLines={1}>
                            {[j.kind, j.postcode].filter(Boolean).join(" · ")}
                          </AppText>
                          {j.changeRequested && (
                            <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 12 }}>
                              Asked to move
                            </AppText>
                          )}
                        </View>
                        <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                          <AppText weight="bold" style={{ color: st.ink, fontSize: 11 }}>
                            {st.label}
                          </AppText>
                        </View>
                      </View>
                    </PressableScale>
                  </FadeIn>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
        <PrimaryButton title={picked ? "Add a visit this day" : "Add a visit"} icon="add" onPress={() => router.push(`/visit-form${picked ? `?day=${picked}` : ""}`)} />
      </View>
    </View>
  );
}
