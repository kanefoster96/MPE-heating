import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { router } from "expo-router";
import { openInApp } from "@/lib/open-link";
import { targetFor } from "@/lib/links";
import { colors } from "@/lib/theme";
import type { JobCard as Job, JobStep } from "@/lib/types";

/** Their account's sections are screens of the app; everything else (pay, quote, visit pages) opens as it is. */
function open(url: string) {
  const target = targetFor(url);
  if ("route" in target) router.push(target.route as never);
  else openInApp(url);
}

/** A job's steps, top to bottom: ticked when done, the current one ringed, the rest to come. */
export function StepTracker({ steps, onDark = false }: { steps: JobStep[]; onDark?: boolean }) {
  const ink = onDark ? "#fff" : colors.navy;
  const soft = onDark ? "rgba(255,255,255,0.82)" : colors.text2;
  const line = onDark ? "rgba(255,255,255,0.35)" : colors.edge;
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const dot =
          s.state === "done" ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: onDark ? "#fff" : colors.success, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={14} color={onDark ? colors.success : "#fff"} />
            </View>
          ) : s.state === "now" ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: onDark ? "#fff" : colors.orangeDeep, backgroundColor: onDark ? colors.success : colors.page }} />
          ) : (
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: line }} />
          );
        return (
          <View
            key={`${s.label}-${i}`}
            style={{ flexDirection: "row", gap: 12 }}
            accessible
            accessibilityLabel={`${s.label}${s.detail ? `, ${s.detail}` : ""}. ${s.state === "done" ? "Done" : s.state === "now" ? "Now" : "To come"}`}
          >
            <View style={{ alignItems: "center" }}>
              {dot}
              {!last && <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: s.state === "done" ? (onDark ? "#fff" : colors.success) : line, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 12 }}>
              <AppText weight={s.state === "now" ? "bold" : "semibold"} style={{ color: s.state === "next" ? soft : ink, fontSize: 15, lineHeight: 20 }}>
                {s.label}
              </AppText>
              {s.detail ? <AppText style={{ color: soft, fontSize: 14, lineHeight: 19, marginTop: 1 }}>{s.detail}</AppText> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One job. Today's (on the way, or booked for today) is the green card;
 * the rest are white with their status. Steps, what was done, and the
 * buttons that matter now (pay, pick a time, view the quote).
 */
export function ActiveJob({ job }: { job: Job }) {
  const green = job.status === "underway";
  // A repair still to be scheduled: dotted outline and a timer, not a booking yet.
  const pending = !!job.pending;
  const ink = green ? "#fff" : colors.navy;
  const soft = green ? "rgba(255,255,255,0.85)" : colors.text2;
  const pillBg = green ? "rgba(255,255,255,0.18)" : job.status === "missed" || job.status === "waiting" ? colors.orangeLight : job.status === "done" ? "#e5f3ea" : colors.grey;
  const pillInk = green ? "#fff" : job.status === "missed" || job.status === "waiting" ? colors.orangeDeep : job.status === "done" ? colors.success : colors.navy;
  return (
    <View
      style={{
        backgroundColor: green ? colors.success : pending ? colors.page : colors.card,
        borderRadius: 24,
        borderWidth: green ? 0 : pending ? 1.5 : 1,
        borderStyle: pending ? "dashed" : "solid",
        borderColor: pending ? colors.orangeDeep : colors.edge,
        padding: 18,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        {pending && (
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="timer-outline" size={22} color={colors.orangeDeep} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AppText weight="extrabold" style={{ color: ink, fontSize: 20, lineHeight: 24 }}>
            {job.title}
          </AppText>
          <AppText style={{ color: soft, fontSize: 14, lineHeight: 19, marginTop: 3 }}>{job.when}</AppText>
        </View>
        <View style={{ backgroundColor: pillBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <AppText weight="bold" style={{ color: pillInk, fontSize: 12 }}>
            {job.statusLabel}
          </AppText>
        </View>
      </View>
      <StepTracker steps={job.steps} onDark={green} />
      {job.report ? (
        <View style={{ backgroundColor: green ? "rgba(255,255,255,0.14)" : colors.cream, borderRadius: 16, padding: 12 }}>
          <AppText weight="semibold" style={{ color: ink, fontSize: 13, marginBottom: 2 }}>
            {pending ? "What we found" : "What we did"}
          </AppText>
          <AppText style={{ color: ink, fontSize: 14, lineHeight: 20 }}>{job.report}</AppText>
        </View>
      ) : null}
      {job.actions.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {job.actions.map((a) => (
            <PressableScale
              key={a.label}
              onPress={() => open(a.url)}
              accessibilityLabel={a.label}
              style={{
                minHeight: 44,
                paddingHorizontal: 16,
                borderRadius: 999,
                justifyContent: "center",
                backgroundColor: a.primary ? (green ? "#fff" : colors.orangeDeep) : green ? "rgba(255,255,255,0.16)" : colors.page,
                borderWidth: a.primary ? 0 : 1,
                borderColor: green ? "rgba(255,255,255,0.5)" : colors.edge,
              }}
            >
              <AppText weight="bold" style={{ fontSize: 14, color: a.primary ? (green ? colors.success : "#fff") : ink }}>
                {a.label}
              </AppText>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A finished job in the history: the date and what was done, tap for the rest. */
export function PreviousJob({ job }: { job: Job }) {
  const [openState, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.edge, overflow: "hidden" }}>
      <PressableScale onPress={() => setOpen((o) => !o)} accessibilityLabel={`${job.title}, ${job.when}. ${openState ? "Hide" : "Show"} details`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#e5f3ea", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark-done" size={20} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="bold" style={{ fontSize: 15 }}>
              {job.title}
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 13, marginTop: 1 }} numberOfLines={openState ? undefined : 1}>
              {job.report ?? job.when}
            </AppText>
          </View>
          <Ionicons name={openState ? "chevron-up" : "chevron-down"} size={18} color={colors.text3} />
        </View>
      </PressableScale>
      {openState && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
          <AppText style={{ color: colors.text3, fontSize: 13 }}>{job.when}</AppText>
          <StepTracker steps={job.steps} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {job.actions.map((a) => (
              <PressableScale key={a.label} onPress={() => open(a.url)} accessibilityLabel={a.label} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: colors.edge }}>
                <AppText weight="semibold" style={{ fontSize: 14 }}>
                  {a.label}
                </AppText>
              </PressableScale>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
