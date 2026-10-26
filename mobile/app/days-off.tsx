import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/screen-header";
import { DateField } from "@/components/month-grid";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

type Day = { id: string; startsOn: string; when: string; note: string | null; clashes: number };
type DaysOff = { today: string; days: Day[] };
const PATH = "/api/mobile/staff/days-off";

/**
 * Days off and holidays (the website's, in the app): customers can't ask
 * for a visit on them, and the calendar greys them out. Anything already
 * booked on one is flagged, and opens that day to move it.
 */
export default function DaysOffScreen() {
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<DaysOff | null>(() => readCached<DaysOff>(PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<DaysOff>(PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load days off.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const startsOn = first ?? data?.today ?? "";
  const endsOn = last && last >= startsOn ? last : startsOn;

  async function add() {
    if (saving || !startsOn) return;
    setSaving(true);
    try {
      await apiPost(PATH, { startsOn, endsOn, note });
      haptic.success();
      setFirst(null);
      setLast(null);
      setNote("");
      load();
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: Day) {
    if (!(await confirmAction("Remove these days off?", `${d.when}. Customers can ask for visits then again.`, "Remove"))) return;
    try {
      await apiPost(PATH, { id: d.id }, "DELETE");
      haptic.success();
      load();
    } catch (err) {
      notify("Not removed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Days off" />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={230} radius={20} />
          <Skeleton height={70} radius={18} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
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
          <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20, marginHorizontal: 4 }}>
            Holidays and days you&apos;re not working. Customers won&apos;t be offered them when they ask for a visit.
          </AppText>
          <Card style={{ gap: 10 }}>
            <DateField label="First day" value={startsOn} today={data.today} past={false} stacked onChange={setFirst} />
            <DateField label="Last day (the same for one day)" value={endsOn} today={data.today} past={false} stacked onChange={setLast} />
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={120}
              placeholder="Note, only the team see it (e.g. Holiday)"
              placeholderTextColor={colors.text3}
              accessibilityLabel="Note"
              style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 14, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }}
            />
            <PrimaryButton title={saving ? "Saving…" : startsOn === endsOn ? "Add the day off" : "Add the days off"} icon="sunny" size="medium" onPress={add} />
          </Card>

          {data.days.length ? (
            data.days.map((d, i) => (
              <FadeIn key={d.id} index={Math.min(i, 8)}>
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="bold" style={{ fontSize: 15 }}>
                        {d.when}
                      </AppText>
                      {d.note && <AppText style={{ color: colors.text2, fontSize: 13 }}>{d.note}</AppText>}
                    </View>
                    <PressableScale onPress={() => remove(d)} accessibilityLabel={`Remove ${d.when}`} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
                      <AppText weight="semibold" style={{ color: colors.danger, fontSize: 14 }}>
                        Remove
                      </AppText>
                    </PressableScale>
                  </View>
                  {d.clashes > 0 && (
                    <PressableScale onPress={() => router.push(`/calendar?day=${d.startsOn}`)} accessibilityLabel={`${d.clashes} visits already booked then. Open the calendar to move them`} style={{ minHeight: 44, justifyContent: "center" }}>
                      <AppText weight="bold" style={{ color: colors.danger, fontSize: 13, textDecorationLine: "underline" }}>
                        {d.clashes} visit{d.clashes === 1 ? "" : "s"} already booked then: move {d.clashes === 1 ? "it" : "them"}
                      </AppText>
                    </PressableScale>
                  )}
                </Card>
              </FadeIn>
            ))
          ) : (
            <AppText style={{ color: colors.text2, fontSize: 14, marginLeft: 4 }}>None coming up.</AppText>
          )}
        </ScrollView>
      )}
    </View>
  );
}
