import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActiveJob, PreviousJob } from "@/components/job-card";
import { StaffJobCard } from "@/components/staff-job";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, SecondaryButton, Skeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { openBooking, openInApp } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors } from "@/lib/theme";
import type { JobCard, StaffDay, ToSchedule } from "@/lib/types";

const PAD = 20;

/**
 * Jobs. A customer sees what's underway (today's is the green card), each
 * with its steps, and their previous jobs underneath: everything done to
 * their boiler. The team see their day instead (Kanvas Academy's
 * registers tab, as a job list): pick a day on the strip, then each visit
 * with its buttons. The full calendar is the website's schedule.
 */
export default function JobsTab() {
  const { staff, signedIn } = useAuth();
  if (staff) return <TeamDay />;
  if (!signedIn) return <SignedOut />;
  return <MyJobs />;
}

function SignedOut() {
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: PAD, gap: 16 }}>
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="clipboard" size={30} color={colors.orangeDeep} />
        </View>
        <AppText weight="bold" style={{ fontSize: 20, marginTop: 4, textAlign: "center" }}>
          Your jobs, step by step
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21, textAlign: "center" }}>
          Sign in with the email you booked with to follow each job: booked, on the way, done and paid. And everything we&apos;ve done to your boiler.
        </AppText>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
          <PrimaryButton title="Sign in" icon="person" size="medium" onPress={() => router.push("/sign-in")} />
          <SecondaryButton title="Book a call-out" icon="flame" onPress={() => openInApp(`${SITE_URL}/emergency`)} />
        </View>
      </Card>
    </ScrollView>
  );
}

function JobsSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1].map((i) => (
        <View key={i} style={{ backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.edge, padding: 18, gap: 12 }}>
          <Skeleton width="55%" height={20} radius={8} />
          <Skeleton width="80%" height={14} radius={7} />
          {[0, 1, 2].map((j) => (
            <View key={j} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Skeleton width={22} height={22} radius={11} />
              <Skeleton width="60%" height={14} radius={7} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MyJobs() {
  const [data, setData] = useState<{ active: JobCard[]; previous: JobCard[] } | null>(() => readCached("/api/mobile/jobs") ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<{ active: JobCard[]; previous: JobCard[] }>("/api/mobile/jobs"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your jobs.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: PAD, paddingBottom: 40, gap: 12 }}
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
      <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, letterSpacing: -0.5 }}>
        My jobs
      </AppText>
      {error && !data ? (
        <LoadError message={error} onRetry={load} />
      ) : !data ? (
        <JobsSkeleton />
      ) : (
        <>
          {data.active.length ? (
            data.active.map((job, i) => (
              <FadeIn key={job.id} index={i}>
                <ActiveJob job={job} />
              </FadeIn>
            ))
          ) : (
            <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <AppText weight="bold" style={{ fontSize: 17 }}>
                Nothing on at the moment
              </AppText>
              <AppText style={{ color: colors.text2, textAlign: "center" }}>When you book with us, the job shows here and we&apos;ll keep you posted at each step.</AppText>
              <View style={{ alignSelf: "stretch", gap: 10, marginTop: 8 }}>
                <PrimaryButton title="Book a call-out" icon="flame" size="medium" onPress={() => openBooking(`${SITE_URL}/emergency`, true)} />
                <SecondaryButton title="Book a service" icon="build" onPress={() => openBooking(`${SITE_URL}/book/service`, true)} />
              </View>
            </Card>
          )}

          {data.previous.length > 0 && (
            <>
              <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 20, marginTop: 20 }}>
                Previous jobs
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 14, marginTop: -6 }}>Everything we&apos;ve done for you, newest first.</AppText>
              {data.previous.map((job, i) => (
                <FadeIn key={job.id} index={i}>
                  <PreviousJob job={job} />
                </FadeIn>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function stripLabel(iso: string, i: number): { top: string; bottom: string } {
  const d = new Date(`${iso}T12:00:00`);
  if (i === 0) return { top: "Today", bottom: String(d.getDate()) };
  return { top: d.toLocaleDateString("en-GB", { weekday: "short" }), bottom: String(d.getDate()) };
}

/**
 * A repair agreed after a call-out but not booked yet (waiting on a part,
 * say): dotted, with a timer, under every day so it can go straight onto
 * the day being looked at once the part's in. With its price still to
 * send, that comes first: Send the price opens a quote for the job.
 */
function RepairToSchedule({ item, day, dayLabel }: { item: ToSchedule; day: string; dayLabel: string }) {
  const router = useRouter();
  const waited = item.waitingDays === 0 ? "Since today" : `Waiting ${item.waitingDays} day${item.waitingDays === 1 ? "" : "s"}`;
  return (
    <View style={{ borderRadius: 24, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.orangeDeep, backgroundColor: colors.page, padding: 16, gap: 12 }}>
      <PressableScale onPress={() => router.push(`/job/${item.id}`)} accessibilityLabel={`Repair to be scheduled for ${item.name}, to ${item.what}. ${waited}. Open the call-out`}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="timer-outline" size={22} color={colors.orangeDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 13 }}>
              Repair to be scheduled · {waited.toLowerCase()}
            </AppText>
            <AppText weight="extrabold" style={{ fontSize: 18, marginTop: 2 }}>
              {item.name}
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 2 }}>
              To {item.what}. Call-out {item.since}.
            </AppText>
            {item.priceNeeded && (
              <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 14, marginTop: 4 }}>
                Price to send
              </AppText>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </View>
      </PressableScale>
      {item.priceNeeded && (
        <PressableScale onPress={() => router.push(`/new-quote?visit=${item.id}`)} accessibilityLabel={`Send ${item.name} the price`}>
          <View style={{ minHeight: 44, borderRadius: 999, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 12 }}>
            <Ionicons name="document-text" size={16} color="#fff" />
            <AppText weight="bold" style={{ color: "#fff", fontSize: 14 }}>
              Send the price
            </AppText>
          </View>
        </PressableScale>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PressableScale onPress={() => router.push(`/visit-form?followUp=${item.id}&day=${day}`)} accessibilityLabel={`Book it for ${dayLabel}`} style={{ flex: 1 }}>
          <View style={{ minHeight: 44, borderRadius: 999, backgroundColor: item.priceNeeded ? colors.card : colors.orangeDeep, borderWidth: item.priceNeeded ? 1 : 0, borderColor: colors.edge, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 12 }}>
            <Ionicons name="calendar" size={16} color={item.priceNeeded ? colors.navy : "#fff"} />
            <AppText weight="bold" style={{ color: item.priceNeeded ? colors.navy : "#fff", fontSize: 14 }} numberOfLines={1}>
              Book for {dayLabel.toLowerCase() === "today" || dayLabel.toLowerCase() === "tomorrow" ? dayLabel.toLowerCase() : dayLabel.split(" ").slice(0, 3).join(" ")}
            </AppText>
          </View>
        </PressableScale>
        {item.conversationId && (
          <PressableScale onPress={() => router.push(`/chat/${item.conversationId}`)} accessibilityLabel={`Message ${item.name}`}>
            <View style={{ minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 16 }}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.navy} />
              <AppText weight="bold" style={{ fontSize: 14 }}>
                Message
              </AppText>
            </View>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function TeamDay() {
  const router = useRouter();
  // Home's week strip opens a particular day.
  const params = useLocalSearchParams<{ day?: string }>();
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    if (params.day && params.day !== day) {
      setDay(params.day);
      setData((current) => (current ? { ...current, day: params.day!, jobs: [], label: "…" } : current));
    }
    // Only when a new day comes in from a link, not when the strip changes it.
  }, [params.day]);
  const [data, setData] = useState<StaffDay | null>(() => readCached("/api/mobile/staff/jobs") ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (which: string | null = day) => {
    setError(null);
    try {
      setData(await apiFetch<StaffDay>(`/api/mobile/staff/jobs${which ? `?day=${which}` : ""}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the day.");
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function pick(d: string) {
    setDay(d);
    setData((current) => (current ? { ...current, day: d, jobs: [], label: "…" } : current));
    load(d);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* The fortnight: how full each day is. */}
      <View style={{ height: 90, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" }}>
        {(data?.strip ?? []).map((d, i) => {
          const on = d.day === data?.day;
          const label = stripLabel(d.day, i);
          return (
            <PressableScale key={d.day} onPress={() => pick(d.day)} accessibilityLabel={`${label.top} ${label.bottom}, ${d.closed ? "day off" : `${d.count} job${d.count === 1 ? "" : "s"}`}`} style={{ width: 56 }}>
              <View style={{ height: 68, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.navy : d.closed ? colors.grey : colors.cream, borderWidth: on ? 0 : 1, borderColor: colors.edge }}>
                <AppText weight="semibold" style={{ fontSize: 12, color: on ? "#fff" : colors.text2 }}>
                  {label.top}
                </AppText>
                <AppText weight="extrabold" style={{ fontSize: 18, color: on ? "#fff" : colors.navy }}>
                  {label.bottom}
                </AppText>
                <AppText weight="bold" style={{ fontSize: 11, color: on ? "#ffc53d" : d.closed ? colors.text2 : colors.orangeDeep }}>
                  {d.closed ? "Off" : d.count ? `${d.count} job${d.count === 1 ? "" : "s"}` : " "}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
      </View>

      <ScrollView
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
        {data && data.waiting > 0 && (
          <PressableScale onPress={() => router.push("/notifications")} accessibilityLabel={`${data.waiting} requests waiting`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.orangeLight, borderRadius: 18, padding: 14 }}>
              <Ionicons name="time" size={22} color={colors.orangeDeep} />
              <AppText weight="bold" style={{ flex: 1, color: colors.orangeDeep, fontSize: 15 }}>
                {data.waiting} request{data.waiting === 1 ? "" : "s"} waiting for a time
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.orangeDeep} />
            </View>
          </PressableScale>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 24 }}>
            {data?.label ?? "Today"}
          </AppText>
          <PressableScale onPress={() => router.push(`/calendar${data ? `?day=${data.day}` : ""}`)} accessibilityLabel="Open the full calendar" style={{ height: 44, justifyContent: "center", paddingLeft: 12 }}>
            <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
              Calendar
            </AppText>
          </PressableScale>
        </View>

        {error && !data ? (
          <LoadError message={error} onRetry={() => load()} />
        ) : !data || data.label === "…" ? (
          <JobsSkeleton />
        ) : data.closed !== false ? (
          <Card style={{ alignItems: "center", gap: 6 }}>
            <Ionicons name="sunny" size={32} color={colors.orangeDeep} />
            <AppText weight="bold" style={{ fontSize: 17 }}>
              Day off
            </AppText>
            {data.closed ? <AppText style={{ color: colors.text2 }}>{data.closed}</AppText> : null}
          </Card>
        ) : data.jobs.length === 0 ? (
          <Card style={{ alignItems: "center", gap: 6 }}>
            <AppText weight="bold" style={{ fontSize: 17 }}>
              Nothing booked
            </AppText>
            <AppText style={{ color: colors.text2, textAlign: "center" }}>Add a visit in the calendar and it shows here.</AppText>
          </Card>
        ) : (
          data.jobs.map((job, i) => (
            <FadeIn key={job.id} index={i}>
              <StaffJobCard job={job} day={data.day} onChanged={() => load()} />
            </FadeIn>
          ))
        )}

        {data && data.label !== "…" && (data.toSchedule?.length ?? 0) > 0 && (
          <>
            <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 20, marginTop: 12 }}>
              To be scheduled
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 14, marginTop: -6 }}>Repairs agreed at a call-out. Book one in once the part&apos;s here.</AppText>
            {data.toSchedule!.map((item) => (
              <RepairToSchedule key={item.id} item={item} day={data.day} dayLabel={data.label} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
