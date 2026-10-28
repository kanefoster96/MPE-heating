import { useState, type ComponentProps } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale, haptic } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { useBusinessCall } from "@/components/business-call";
import { openDirections } from "@/lib/open-link";
import { reportSend, type WhatsAppHandoff } from "@/lib/whatsapp-handoff";
import { colors } from "@/lib/theme";
import type { StaffJob } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
const ETAS = [15, 30, 45, 60, 90];
/** Running late: how far the arrival window moves on. */
const LATE = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1½ hours" },
  { minutes: 120, label: "2 hours" },
];

function clock(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h % 12 || 12}${min ? `:${String(min).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

const STATUS: Record<StaffJob["status"], { label: string; bg: string; ink: string }> = {
  requested: { label: "Requested", bg: colors.orangeLight, ink: colors.orangeDeep },
  booked: { label: "Booked", bg: colors.grey, ink: colors.navy },
  done: { label: "Done", bg: "#e5f3ea", ink: colors.success },
  no_access: { label: "Not in", bg: "#fdecec", ink: colors.danger },
  cancelled: { label: "Cancelled", bg: colors.grey, ink: colors.text2 },
};

function Small({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ height: 48, borderRadius: 14, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Ionicons name={icon} size={18} color={colors.navy} />
        <AppText weight="semibold" style={{ fontSize: 11 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

function Big({ label, icon, onPress, tone = "orange" }: { label: string; icon: IconName; onPress: () => void; tone?: "orange" | "navy" | "plain" }) {
  const bg = tone === "orange" ? colors.orangeDeep : tone === "navy" ? colors.navy : colors.page;
  const ink = tone === "plain" ? colors.navy : "#fff";
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: bg, borderWidth: tone === "plain" ? 1 : 0, borderColor: colors.edge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 }}>
        <Ionicons name={icon} size={18} color={ink} />
        <AppText weight="bold" style={{ color: ink, fontSize: 15 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/**
 * One of the day's visits, for the team: when, what, who and where, with
 * the buttons for the job in the order it happens. Call, directions and
 * their chat; then "On my way" (pick how long; WhatsApp Business for someone who's only phoned), "Not in",
 * and Finish (app/finish/[id].tsx: report, boiler, photos, certificates).
 * Once it's done and unpaid, Take payment. In a list, tapping the top
 * opens the job's page (app/job/[id].tsx); on that page `onPay` opens its
 * Payment sheet.
 */
export function StaffJobCard({ job, day, onChanged, onPay }: { job: StaffJob; day: string; onChanged: () => void; onPay?: () => void }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [late, setLate] = useState(false);
  const [busy, setBusy] = useState(false);
  const businessCall = useBusinessCall();
  const status = STATUS[job.status];
  const place = [job.address, job.postcode].filter(Boolean).join(", ");

  /** Running late: the window moves on, and they're told the new one. */
  async function runningLate(minutes: number) {
    setBusy(true);
    try {
      const res = await apiPost<{ message: string; whatsapp?: WhatsAppHandoff | null }>("/api/mobile/staff/jobs/late", { id: job.id, minutes });
      haptic.success();
      setLate(false);
      onChanged();
      await reportSend("Arrival time updated", res);
    } catch (err) {
      haptic.warning();
      Alert.alert("Not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onMyWay(eta: number) {
    setBusy(true);
    try {
      const res = await apiPost<{ message: string; whatsapp?: WhatsAppHandoff | null }>("/api/mobile/staff/jobs/on-my-way", { id: job.id, eta });
      haptic.success();
      setPicking(false);
      onChanged();
      // Someone who's only phoned: send it from WhatsApp Business.
      if (res.whatsapp) await reportSend("On my way", res);
    } catch (err) {
      haptic.warning();
      Alert.alert("Not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function notIn() {
    Alert.alert("Not in?", "Marks the visit as not in. Tomorrow they're offered another time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Not in",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost("/api/mobile/staff/jobs/status", { id: job.id, status: "no_access" });
            haptic.success();
            onChanged();
          } catch (err) {
            Alert.alert("Couldn't change that", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  const head = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ minWidth: 58 }}>
        <AppText weight="extrabold" style={{ fontSize: 15 }}>
          {job.window.split("–")[0]}
        </AppText>
        <AppText style={{ color: colors.text3, fontSize: 12 }}>{job.window.includes("–") ? `to ${job.window.split("–")[1]}` : ""}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 17 }}>
          {job.customer?.name ?? "No customer yet"}
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 1 }}>{[job.kind, job.title].filter(Boolean).join(": ")}</AppText>
        {place ? <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 1 }}>{place}</AppText> : null}
        {job.onPlan ? (
          <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: colors.successTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <AppText weight="bold" style={{ color: colors.success, fontSize: 12 }}>
              Plan member · free call-out
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <View style={{ backgroundColor: status.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <AppText weight="bold" style={{ color: status.ink, fontSize: 12 }}>
            {status.label}
          </AppText>
        </View>
        {!onPay && <Ionicons name="chevron-forward" size={18} color={colors.text3} />}
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: job.onMyWay && job.status === "booked" ? colors.success : colors.edge, padding: 16, gap: 12 }}>
      {onPay ? (
        head
      ) : (
        <PressableScale onPress={() => router.push(`/job/${job.id}`)} accessibilityLabel={`Open the job for ${job.customer?.name ?? "this visit"}`}>
          {head}
        </PressableScale>
      )}

      {job.notes ? (
        <View style={{ backgroundColor: colors.cream, borderRadius: 12, padding: 10 }}>
          <AppText style={{ fontSize: 13, lineHeight: 18, color: colors.text2 }}>{job.notes}</AppText>
        </View>
      ) : null}
      {job.cantMake && (
        <AppText weight="semibold" style={{ color: colors.danger, fontSize: 13 }}>
          They won&apos;t be in. Move it to a new time, or cancel it.
        </AppText>
      )}
      {job.changeRequested && (
        <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 13 }}>
          They&apos;ve asked to move this visit: see Requests.
        </AppText>
      )}
      {job.onMyWay && job.status === "booked" && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Ionicons name="car" size={16} color={colors.success} />
          <AppText weight="semibold" style={{ color: colors.success, fontSize: 14 }}>
            On the way: told them around {job.onMyWay}
          </AppText>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        {job.customer?.phone && <Small icon="call" label="Call" onPress={() => businessCall.call({ name: job.customer!.name ?? "the customer", to: job.customer!.phone, directNumber: job.customer!.phone })} />}
        {place ? <Small icon="navigate" label="Directions" onPress={() => openDirections(place)} /> : null}
        {job.customer?.conversationId && <Small icon="chatbubbles" label="Chat" onPress={() => router.push(`/chat/${job.customer!.conversationId}`)} />}
      </View>

      {job.status === "booked" &&
        (picking ? (
          <View style={{ gap: 8 }}>
            <AppText weight="semibold" style={{ fontSize: 14 }}>
              With them in about…
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ETAS.map((m) => (
                <PressableScale key={m} onPress={() => (busy ? undefined : onMyWay(m))} accessibilityLabel={`${m} minutes`} style={{ height: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center" }}>
                  <AppText weight="bold" style={{ color: "#fff", fontSize: 15 }}>
                    {m} min
                  </AppText>
                </PressableScale>
              ))}
              <PressableScale onPress={() => setPicking(false)} accessibilityLabel="Cancel" style={{ height: 44, paddingHorizontal: 14, justifyContent: "center" }}>
                <AppText weight="semibold" style={{ color: colors.text2 }}>
                  Cancel
                </AppText>
              </PressableScale>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Big label={job.onMyWay ? "Send again" : "On my way"} icon="car" onPress={() => setPicking(true)} tone={job.onMyWay ? "plain" : "orange"} />
            <Big label="Finish" icon="checkmark-done" tone="navy" onPress={() => router.push(`/finish/${job.id}`)} />
          </View>
        ))}
      {job.status === "booked" && !picking && late && (
        <View style={{ gap: 8 }}>
          <AppText weight="semibold" style={{ fontSize: 14 }}>
            Running late by…
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {LATE.map((l) => (
              <PressableScale
                key={l.minutes}
                onPress={() => (busy ? undefined : runningLate(l.minutes))}
                accessibilityLabel={`${l.label}: new arrival time ${clock(job.start + l.minutes)} to ${clock(job.end + l.minutes)}`}
                style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.orangeLight, justifyContent: "center" }}
              >
                <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
                  {l.label}
                </AppText>
                <AppText style={{ color: colors.navy, fontSize: 12 }}>
                  {clock(job.start + l.minutes)}–{clock(job.end + l.minutes)}
                </AppText>
              </PressableScale>
            ))}
            <PressableScale onPress={() => setLate(false)} accessibilityLabel="Cancel" style={{ height: 48, paddingHorizontal: 14, justifyContent: "center" }}>
              <AppText weight="semibold" style={{ color: colors.text2 }}>
                Cancel
              </AppText>
            </PressableScale>
          </View>
          <AppText style={{ color: colors.text2, fontSize: 12 }}>They get the new arrival time, with a link to say if they won&apos;t be in.</AppText>
        </View>
      )}
      {job.status === "booked" && !picking && !late && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
          <PressableScale onPress={() => setLate(true)} accessibilityLabel="Running late" style={{ height: 44, justifyContent: "center", paddingHorizontal: 8 }}>
            <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
              Running late
            </AppText>
          </PressableScale>
          <PressableScale onPress={notIn} accessibilityLabel="Not in" style={{ height: 44, justifyContent: "center", paddingHorizontal: 8 }}>
            <AppText weight="semibold" style={{ color: colors.danger, fontSize: 14 }}>
              Not in
            </AppText>
          </PressableScale>
        </View>
      )}
      {job.status === "done" && job.openPayment && <Big label={`Take payment, ${job.openPayment.amount}`} icon="card" onPress={onPay ?? (() => router.push(`/job/${job.id}?pay=1`))} />}
      {job.status === "done" && job.paid && (
        <AppText weight="semibold" style={{ color: colors.success, fontSize: 14 }}>
          Paid
        </AppText>
      )}
      {/* On the job's own page, a request is answered further down. */}
      {(job.status === "no_access" || (job.status === "requested" && !onPay)) && (
        <Big label={job.status === "requested" ? "Answer the request" : "Pick a new time"} icon="calendar" tone="plain" onPress={() => router.push(job.status === "requested" ? `/job/${job.id}` : `/visit-form?id=${job.id}`)} />
      )}
      {businessCall.modal}
    </View>
  );
}
