import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale, PrimaryButton, haptic } from "@/components/ui";
import { useTapToPay } from "@/components/tap-to-pay";
import { apiPost } from "@/lib/api";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { JobPayment, StaffJobDetail } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Action = "charge" | "in_person" | "cash" | "bank_transfer" | "resend";

function whereFrom(p: JobPayment): string {
  if (p.job === "this") return "This job";
  if (p.job === "none") return "Not on a job yet: goes on this one";
  return `From the ${p.job} visit`;
}

function Option({ p, on, onPress }: { p: JobPayment; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${p.number}, ${p.kind === "callout_fee" ? "call-out fee" : p.description}, ${p.amount}${on ? ", selected" : ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? colors.orangeDeep : colors.edge, backgroundColor: on ? "#fff7f3" : colors.card }}>
        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? colors.orangeDeep : colors.text3} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={2}>
            {p.kind === "callout_fee" ? "Call-out fee" : p.description}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 13 }}>
            {p.number} · {whereFrom(p)}
          </AppText>
        </View>
        <AppText weight="extrabold" style={{ fontSize: 18 }}>
          {p.amount}
        </AppText>
      </View>
    </PressableScale>
  );
}

function Choice({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <View style={{ minHeight: 50, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.page, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 }}>
        <Ionicons name={icon} size={18} color={colors.navy} />
        <AppText weight="bold" style={{ fontSize: 15 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/**
 * The job page's Payment button: pick what it's for, then take it. Open
 * invoices on this job come first, then the customer's other open ones (an
 * invoice not on a job yet goes on this one when it's taken). Then Tap to
 * Pay, their saved card, paid another way (with a receipt), or the link
 * again. A new invoice or call-out fee is the website's take-payment page
 * for this visit (call-out credit, products, monthly payments), opened
 * signed in; it shows here when they come back.
 */
export function PaymentSheet({ visible, detail, onClose, onDone }: { visible: boolean; detail: StaffJobDetail; onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { job, payments } = detail;
  const choices = [...payments.forJob, ...payments.otherOpen].filter((p) => p.status === "open" && !p.monthly);
  const monthly = [...payments.forJob, ...payments.otherOpen].filter((p) => p.status === "open" && p.monthly);
  const [picked, setPicked] = useState<string | null>(choices[0]?.id ?? null);
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const tap = useTapToPay(payments.terminalLocation);
  const chosen = choices.find((p) => p.id === picked) ?? null;
  const first = job.customer?.name?.split(" ")[0] ?? "them";

  useEffect(() => {
    if (!visible) return;
    setPicked((current) => (current && choices.some((p) => p.id === current) ? current : (choices[0]?.id ?? null)));
    setOther(false);
    // The open invoices change after a payment; keep the pick if it's still there.
  }, [visible, detail]);

  async function act(action: Action, confirm?: string) {
    if (!chosen || busy) return;
    const run = async () => {
      setBusy(action);
      try {
        const res = await apiPost<{ ok: boolean; message?: string }>("/api/mobile/staff/jobs/payment", { jobId: job.id, paymentId: chosen.id, action });
        haptic.success();
        Alert.alert(action === "resend" ? "Sent" : "Paid", res.message ?? "Done.");
        onDone();
        if (action !== "resend") onClose();
      } catch (err) {
        haptic.warning();
        Alert.alert("Not done", err instanceof Error ? err.message : "Please try again.");
      } finally {
        setBusy(null);
      }
    };
    if (!confirm) return run();
    Alert.alert(confirm, `${chosen.amount} for ${chosen.number}. We'll send ${first} a receipt.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", onPress: run },
    ]);
  }

  async function tapToPay() {
    if (!chosen || busy) return;
    setBusy("tap");
    try {
      // On this job first, so the payment's recorded against it.
      await apiPost("/api/mobile/staff/jobs/payment", { jobId: job.id, paymentId: chosen.id, action: "link" });
    } catch (err) {
      setBusy(null);
      haptic.warning();
      Alert.alert("Not taken", err instanceof Error ? err.message : "Please try again.");
      return;
    }
    const result = await tap.take(chosen.id);
    setBusy(null);
    if (result.ok) {
      haptic.success();
      Alert.alert("Paid", `${chosen.amount} taken${job.customer?.name ? ` from ${job.customer.name}` : ""}. We'll send their receipt.`);
      onClose();
      // The webhook marks it paid a moment later.
      setTimeout(onDone, 2500);
    } else if (!result.cancelled) {
      haptic.warning();
      Alert.alert("Not taken", result.message);
    }
  }

  function newPayment() {
    onClose();
    openSignedIn(`/staff/payments/new?visit=${job.id}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: "rgba(31,42,58,0.45)" }} />
      <View style={{ maxHeight: "88%", backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.skeleton }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 22 }}>
              Take payment
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 14 }} numberOfLines={1}>
              {[job.customer?.name, job.kind].filter(Boolean).join(" · ")}
            </AppText>
          </View>
          <PressableScale onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={26} color={colors.navy} />
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}>
          {!payments.on && (
            <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>Card payments start once Stripe is connected. You can still record cash, bank transfer or another card machine.</AppText>
          )}
          {choices.length ? (
            <>
              <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                What&apos;s it for?
              </AppText>
              {choices.map((p) => (
                <Option key={p.id} p={p} on={p.id === picked} onPress={() => setPicked(p.id)} />
              ))}
            </>
          ) : (
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>Nothing&apos;s waiting to be paid for {job.customer?.name ?? "this job"}. Make the invoice or call-out fee first.</AppText>
          )}
          {monthly.map((p) => (
            <AppText key={p.id} style={{ color: colors.text2, fontSize: 13 }}>
              {p.number} ({p.amount}) is being paid monthly: record payments on it from the website.
            </AppText>
          ))}
          <Choice icon="add-circle-outline" label="New invoice or call-out fee" onPress={newPayment} />

          {chosen && (
            <View style={{ gap: 10, marginTop: 10 }}>
              {busy === "tap" ? (
                <View style={{ height: 60, borderRadius: 999, backgroundColor: colors.navy, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <ActivityIndicator color="#fff" />
                  <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
                    Hold their card to your phone…
                  </AppText>
                </View>
              ) : tap.supported && payments.on ? (
                <PrimaryButton title={`Tap to Pay ${chosen.amount}`} icon="wifi" onPress={tapToPay} />
              ) : (
                <AppText style={{ color: colors.text2, fontSize: 13, textAlign: "center" }}>Tap to Pay works in the MPE app on your phone, once it&apos;s set up.</AppText>
              )}
              {payments.savedCard && payments.on && (
                <Choice icon="card-outline" label={busy === "charge" ? "Charging…" : `Charge their ${payments.savedCard.brand} ending ${payments.savedCard.last4}`} disabled={!!busy} onPress={() => act("charge", `Charge their ${payments.savedCard!.brand}?`)} />
              )}
              {other ? (
                <View style={{ gap: 8 }}>
                  <AppText weight="semibold" style={{ fontSize: 14, marginLeft: 4 }}>
                    How did they pay?
                  </AppText>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(
                      [
                        ["in_person", "Card machine"],
                        ["cash", "Cash"],
                        ["bank_transfer", "Bank"],
                      ] as const
                    ).map(([via, label]) => (
                      <PressableScale key={via} onPress={() => act(via, `Paid by ${label.toLowerCase()}?`)} accessibilityLabel={label} style={{ flex: 1 }}>
                        <View style={{ height: 48, borderRadius: 14, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center" }}>
                          <AppText weight="bold" style={{ fontSize: 14 }}>
                            {label}
                          </AppText>
                        </View>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ) : (
                <Choice icon="cash-outline" label="Paid another way" disabled={!!busy} onPress={() => setOther(true)} />
              )}
              {payments.on && <Choice icon="paper-plane-outline" label={busy === "resend" ? "Sending…" : "Send them the link again"} disabled={!!busy} onPress={() => act("resend")} />}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
