import { useCallback, useState, type ComponentProps } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StaffJobCard } from "@/components/staff-job";
import { AppText, Card, FadeIn, LoadError, PressableScale, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { StaffDay, StaffJob, StaffOverview } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
const DAY_PATH = "/api/mobile/staff/jobs";
const MENU_PATH = "/api/mobile/staff/overview";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const STATUS: Record<StaffJob["status"], { label: string; ink: string; bg: string }> = {
  requested: { label: "Requested", bg: colors.orangeLight, ink: colors.orangeDeep },
  booked: { label: "Booked", bg: colors.grey, ink: colors.navy },
  done: { label: "Done", bg: "#e5f3ea", ink: colors.success },
  no_access: { label: "Not in", bg: "#fdecec", ink: colors.danger },
  cancelled: { label: "Cancelled", bg: colors.grey, ink: colors.text2 },
};

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ height: 84, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center", gap: 6 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={19} color={colors.orangeDeep} />
        </View>
        <AppText weight="semibold" style={{ fontSize: 13, textAlign: "center" }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/**
 * The team's Home: today, not the customer's booking page. What's up next
 * (with its buttons), the rest of the day, the week at a glance, the
 * everyday actions, and anything that needs them (from the Menu's cards).
 * The full day is Jobs; everything else is the Menu.
 */
export function TeamHome() {
  const router = useRouter();
  const { me } = useAuth();
  const [day, setDay] = useState<StaffDay | null>(() => readCached<StaffDay>(DAY_PATH) ?? null);
  const [menu, setMenu] = useState<StaffOverview | null>(() => readCached<StaffOverview>(MENU_PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, m] = await Promise.all([apiFetch<StaffDay>(DAY_PATH), apiFetch<StaffOverview>(MENU_PATH).catch(() => null)]);
      setDay(d);
      if (m) setMenu(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load today.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const first = (me?.user.name ?? "").split(" ")[0];
  const jobs = day?.jobs ?? [];
  const minutes = nowMinutes();
  const open = jobs.filter((j) => j.status === "booked");
  // Up next: the first visit still to do that hasn't finished its window, else the first still to do.
  const next = open.find((j) => j.end > minutes) ?? open[0] ?? null;
  const done = jobs.filter((j) => j.status === "done").length;
  const needs = (menu?.cards ?? []).filter((c) => c.tone === "alert");
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
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
      <View style={{ paddingHorizontal: 4 }}>
        <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, letterSpacing: -0.5 }}>
          {first && !first.includes("@") ? `${greeting()}, ${first}` : greeting()}
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 15, marginTop: 2 }}>
          {todayLabel}
          {day && day.closed === false ? ` · ${jobs.length} job${jobs.length === 1 ? "" : "s"} today${done ? `, ${done} done` : ""}` : ""}
        </AppText>
      </View>

      {error && !day ? (
        <LoadError message={error} onRetry={load} />
      ) : !day ? (
        <>
          <Skeleton height={220} radius={22} />
          <Skeleton height={140} radius={22} />
        </>
      ) : (
        <>
          {/* Up next. */}
          {day.closed !== false ? (
            <Card style={{ alignItems: "center", gap: 6 }}>
              <Ionicons name="sunny" size={32} color={colors.orangeDeep} />
              <AppText weight="bold" style={{ fontSize: 17 }}>
                Day off today
              </AppText>
            </Card>
          ) : next ? (
            <View style={{ gap: 8 }}>
              <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                Up next
              </AppText>
              <StaffJobCard job={next} day={day.day} onChanged={load} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.success, borderRadius: 22, padding: 18 }}>
              <Ionicons name="checkmark-circle" size={30} color="#fff" />
              <View style={{ flex: 1 }}>
                <AppText weight="bold" style={{ color: "#fff", fontSize: 17 }}>
                  {jobs.length ? "All done for today" : "Nothing booked today"}
                </AppText>
                <AppText style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>{jobs.length ? `${done} job${done === 1 ? "" : "s"} finished.` : "Add a visit in the calendar."}</AppText>
              </View>
            </View>
          )}

          {/* The rest of today. */}
          {jobs.length > 0 && (
            <Card style={{ paddingVertical: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                <AppText weight="bold" style={{ fontSize: 17 }}>
                  Today
                </AppText>
                <PressableScale onPress={() => router.push("/jobs")} accessibilityLabel="See the whole day" style={{ height: 40, justifyContent: "center", paddingLeft: 12 }}>
                  <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                    See the day
                  </AppText>
                </PressableScale>
              </View>
              {jobs.map((j, i) => {
                const st = STATUS[j.status];
                return (
                  <PressableScale key={j.id} onPress={() => router.push("/jobs")} accessibilityLabel={`${j.window.split("–")[0]}, ${j.customer?.name ?? "No customer"}, ${j.kind}, ${st.label}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.edge, opacity: j.status === "done" ? 0.7 : 1 }}>
                      <AppText weight="bold" style={{ width: 62, fontSize: 14 }}>
                        {j.window.split("–")[0]}
                      </AppText>
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold" style={{ fontSize: 15 }} numberOfLines={1}>
                          {j.customer?.name ?? "No customer yet"}
                        </AppText>
                        <AppText style={{ color: colors.text2, fontSize: 13 }} numberOfLines={1}>
                          {[j.kind, j.postcode].filter(Boolean).join(" · ")}
                        </AppText>
                      </View>
                      <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <AppText weight="bold" style={{ color: st.ink, fontSize: 11 }}>
                          {j.id === next?.id ? "Next" : st.label}
                        </AppText>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
            </Card>
          )}

          {/* The week. */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
              <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" }}>
                This week
              </AppText>
              <PressableScale onPress={() => openSignedIn("/staff/schedule")} accessibilityLabel="Open the calendar" style={{ height: 40, justifyContent: "center", paddingLeft: 12 }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                  Calendar
                </AppText>
              </PressableScale>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {day.strip.slice(0, 7).map((d, i) => {
                const date = new Date(`${d.day}T12:00:00`);
                return (
                  <PressableScale key={d.day} onPress={() => router.push({ pathname: "/jobs", params: { day: d.day } })} accessibilityLabel={`${date.toLocaleDateString("en-GB", { weekday: "long" })}: ${d.closed ? "day off" : `${d.count} jobs`}`} style={{ flex: 1 }}>
                    <View style={{ height: 70, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? colors.navy : d.closed ? colors.grey : colors.card, borderWidth: i === 0 ? 0 : 1, borderColor: colors.edge }}>
                      <AppText weight="semibold" style={{ fontSize: 11, color: i === 0 ? "#fff" : colors.text2 }}>
                        {date.toLocaleDateString("en-GB", { weekday: "short" })}
                      </AppText>
                      <AppText weight="extrabold" style={{ fontSize: 18, color: i === 0 ? "#fff" : colors.navy }}>
                        {d.closed ? "–" : d.count}
                      </AppText>
                      <AppText style={{ fontSize: 10, color: i === 0 ? "#fff" : colors.text2 }}>{d.closed ? "off" : "jobs"}</AppText>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Everyday actions. */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Action icon="card" label="Take payment" onPress={() => router.push("/take-payment")} />
              <Action icon="calendar" label="Add a visit" onPress={() => openSignedIn("/staff/schedule")} />
            </View>
            {me?.admin ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Action icon="receipt" label="New invoice" onPress={() => openSignedIn("/staff/payments/new")} />
                <Action icon="create" label="New quote" onPress={() => openSignedIn("/staff/quotes/new")} />
              </View>
            ) : null}
          </View>

          {/* Anything that needs them. */}
          <Card style={{ paddingVertical: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
              <AppText weight="bold" style={{ fontSize: 17 }}>
                {needs.length ? "Needs you" : "All in order"}
              </AppText>
              <PressableScale onPress={() => router.push("/menu")} accessibilityLabel="Open the Menu" style={{ height: 40, justifyContent: "center", paddingLeft: 12 }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                  Menu
                </AppText>
              </PressableScale>
            </View>
            {needs.length ? (
              needs.map((c, i) => (
                <FadeIn key={c.id} index={i}>
                  <PressableScale onPress={() => (c.route ? router.push(c.route as never) : c.path ? openSignedIn(c.path) : undefined)} accessibilityLabel={`${c.title}: ${c.caption}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.edge }}>
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={c.icon as IconName} size={17} color={colors.orangeDeep} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold" style={{ fontSize: 15 }}>
                          {c.title}
                        </AppText>
                        <AppText style={{ color: colors.text2, fontSize: 13 }}>{c.caption}</AppText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </View>
                  </PressableScale>
                </FadeIn>
              ))
            ) : (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingBottom: 8 }}>No requests, messages or payments waiting on you.</AppText>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
