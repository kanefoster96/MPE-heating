import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale, PrimaryButton, haptic } from "@/components/ui";
import { useTapToPay, type TapWith } from "@/components/tap-to-pay";
import { apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";
import type { JobPayment, SheetContext } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Action = "charge" | "cash" | "bank_transfer" | "resend";

function whereFrom(p: JobPayment): string {
  if (p.job === "this") return "This job";
  if (p.job === "none") return "Not on a job yet";
  return `From the ${p.job} visit`;
}

function penceFrom(text: string): number | null {
  const pounds = Number(text.replace(/[£,\s]/g, ""));
  return Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : null;
}

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function Option({ p, on, onPress }: { p: JobPayment; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${p.number}, ${p.kind === "callout_fee" ? "call-out fee" : p.description}, ${p.amount} to pay${on ? ", selected" : ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? colors.orangeDeep : colors.edge, backgroundColor: on ? "#fff7f3" : colors.card }}>
        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? colors.orangeDeep : colors.text3} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={2}>
            {p.kind === "callout_fee" ? "Call-out fee" : p.description}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 13 }}>
            {p.number} · {whereFrom(p)}
          </AppText>
          {p.paidSoFar && (
            <AppText weight="semibold" style={{ color: colors.success, fontSize: 13 }}>
              {p.paidSoFar} paid of {p.total}
            </AppText>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText weight="extrabold" style={{ fontSize: 18 }}>
            {p.amount}
          </AppText>
          {p.paidSoFar && <AppText style={{ color: colors.text2, fontSize: 12 }}>left</AppText>}
        </View>
      </View>
    </PressableScale>
  );
}

/** A white row button for the other ways to pay. */
function Choice({ icon, label, detail, onPress, disabled }: { icon: IconName; label: string; detail?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={detail ? `${label}. ${detail}` : label}>
      <View style={{ minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.page, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={19} color={colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }}>
            {label}
          </AppText>
          {detail ? <AppText style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>{detail}</AppText> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </View>
    </PressableScale>
  );
}

/**
 * The Payment sheet, from a job's page or the Payment tab. Pick what it's
 * for (this job's open invoices first, then the customer's others; one not
 * on a job yet goes on this one when it's taken), then take it:
 *  - Tap to Pay on the phone, or a Bluetooth card reader, recorded
 *    automatically like any card payment;
 *  - the card they saved with MPE, once Fergal's checked with them;
 *  - the payment link, to their chat, text and email, to pay with Apple
 *    Pay there and then;
 *  - cash, all of it or part: part comes off what's left, and the rest is
 *    taken by card or the link;
 *  - or a bank transfer.
 * A new invoice or call-out fee for the job is app/new-payment.tsx.
 */
export function PaymentSheet({ visible, context, onClose, onDone }: { visible: boolean; context: SheetContext; onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const choices = context.choices.filter((p) => p.status === "open" && !p.monthly && p.amountPence > 0);
  const monthly = context.choices.filter((p) => p.status === "open" && p.monthly);
  const [picked, setPicked] = useState<string | null>(choices[0]?.id ?? null);
  const [cash, setCash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tap = useTapToPay(context.terminalLocation);
  const chosen = choices.find((p) => p.id === picked) ?? null;
  const first = context.customerName?.split(" ")[0] ?? null;

  useEffect(() => {
    if (!visible) return;
    setPicked((current) => (current && choices.some((p) => p.id === current) ? current : (choices[0]?.id ?? null)));
    setCash(null);
    // After a payment the open invoices change; keep the pick while it's still there.
  }, [visible, context]);

  async function post(action: Action, amountPence?: number) {
    if (!chosen) return null;
    setBusy(action);
    try {
      return await apiPost<{ ok: boolean; message: string; leftPence: number }>("/api/mobile/staff/payments/take", { paymentId: chosen.id, jobId: context.jobId, action, amountPence });
    } catch (err) {
      haptic.warning();
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function chargeCard() {
    if (!chosen || !context.savedCard || busy) return;
    const ok = await confirmAction(
      `Check with ${first ?? "the customer"} first`,
      `Is it OK to charge ${chosen.amount} to their ${context.savedCard.brand} ending ${context.savedCard.last4}? They'll get a receipt.`,
      `Charge ${chosen.amount}`,
    );
    if (!ok) return;
    const res = await post("charge");
    if (!res) return;
    haptic.success();
    notify("Paid", res.message);
    onDone();
    onClose();
  }

  async function sendLink() {
    if (!chosen || busy) return;
    const res = await post("resend");
    if (!res) return;
    haptic.success();
    notify("Link sent", `${res.message} ${first ?? "They"} can pay with Apple Pay, Google Pay or card from there.`);
    onDone();
  }

  async function takeCash() {
    if (!chosen || busy || cash === null) return;
    const pence = penceFrom(cash);
    if (!pence) return notify("How much?", "Enter the cash they gave you.");
    if (pence > chosen.amountPence) return notify("That's more than what's left", `Only ${chosen.amount} is left to pay.`);
    const part = pence < chosen.amountPence;
    const ok = await confirmAction(
      part ? `${money(pence)} cash now?` : `${chosen.amount} in cash?`,
      part ? `${money(chosen.amountPence - pence)} will be left to take by card or the link.` : "That's all of it. They'll get a receipt.",
      "Record it",
    );
    if (!ok) return;
    const res = await post("cash", pence);
    if (!res) return;
    haptic.success();
    setCash(null);
    notify(res.leftPence > 0 ? "Cash recorded" : "Paid", res.message);
    onDone();
    if (res.leftPence <= 0) onClose();
  }

  async function bankTransfer() {
    if (!chosen || busy) return;
    const ok = await confirmAction("Paid by bank transfer?", `Marks ${chosen.amount} paid. Check it's in the account first.`, "Mark paid");
    if (!ok) return;
    const res = await post("bank_transfer");
    if (!res) return;
    haptic.success();
    notify("Paid", res.message);
    onDone();
    onClose();
  }

  async function takeByCard(how: TapWith) {
    if (!chosen || busy) return;
    setBusy(how);
    try {
      // On this job first, so the payment's recorded against it.
      if (context.jobId) await apiPost("/api/mobile/staff/payments/take", { paymentId: chosen.id, jobId: context.jobId, action: "link" });
    } catch (err) {
      setBusy(null);
      haptic.warning();
      notify("Not taken", err instanceof Error ? err.message : "Please try again.");
      return;
    }
    const result = await tap.take(chosen.id, how);
    setBusy(null);
    if (result.ok) {
      haptic.success();
      notify("Paid", `${chosen.amount} taken${context.customerName ? ` from ${context.customerName}` : ""}. We'll send their receipt.`);
      onClose();
      // The webhook marks it paid a moment later.
      setTimeout(onDone, 2500);
    } else if (!result.cancelled) {
      haptic.warning();
      notify("Not taken", result.message);
    }
  }

  /** The job's accepted quote: its invoice made here (the call-out and any deposit taken off), picked, ready to take. */
  async function billQuote() {
    const q = context.quoteToBill;
    if (!q || !context.jobId || busy) return;
    setBusy("quote");
    try {
      const res = await apiPost<{ paymentId?: string }>(`/api/mobile/staff/quotes/${q.id}`, { action: "invoice", jobId: context.jobId, take: true });
      haptic.success();
      if (res.paymentId) setPicked(res.paymentId);
      onDone();
    } catch (err) {
      haptic.warning();
      notify("Not made", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function newPayment() {
    if (!context.jobId) return;
    onClose();
    router.push(`/new-payment?visit=${context.jobId}`);
  }

  const card = tap.supported && context.on;
  const cashPence = cash === null ? null : penceFrom(cash);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Up with the keyboard, so the cash amount stays in view. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onClose} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: "rgba(31,42,58,0.45)" }} />
        <View style={{ maxHeight: "90%", backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.skeleton }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 22 }}>
                Take payment
              </AppText>
              {context.customerName && (
                <AppText style={{ color: colors.text2, fontSize: 14 }} numberOfLines={1}>
                  {context.customerName}
                </AppText>
              )}
            </View>
            <PressableScale onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={26} color={colors.navy} />
            </PressableScale>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }} keyboardShouldPersistTaps="handled">
            {choices.length ? (
              <>
                {choices.length > 1 && (
                  <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                    What&apos;s it for?
                  </AppText>
                )}
                {choices.map((p) => (
                  <Option key={p.id} p={p} on={p.id === picked} onPress={() => setPicked(p.id)} />
                ))}
              </>
            ) : (
              <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>
                {context.quoteToBill
                  ? "Bill their quote first, then take it here."
                  : `Nothing's waiting to be paid${context.customerName ? ` for ${context.customerName}` : ""}. Make the invoice or call-out fee first.`}
              </AppText>
            )}
            {monthly.map((p) => (
              <AppText key={p.id} style={{ color: colors.text2, fontSize: 13 }}>
                {p.number} is being paid monthly: record payments on it from the website.
              </AppText>
            ))}
            {context.jobId && context.quoteToBill && (
              <Choice
                icon="document-text-outline"
                label={busy === "quote" ? "Making the invoice…" : `Bill quote ${context.quoteToBill.number}: ${context.quoteToBill.amount}`}
                detail={`${context.quoteToBill.detail}. Then take it below.`}
                onPress={billQuote}
                disabled={!!busy}
              />
            )}
            {context.jobId && <Choice icon="add-circle-outline" label="New invoice or call-out fee" detail="For this job." onPress={newPayment} />}

            {chosen && (
              <View style={{ gap: 10, marginTop: 12 }}>
                <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                  How are they paying?
                </AppText>
                {busy === "phone" || busy === "reader" ? (
                  <View style={{ minHeight: 60, borderRadius: 999, backgroundColor: colors.navy, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 }}>
                    <ActivityIndicator color="#fff" />
                    <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
                      {busy === "phone" ? "Hold their card to your phone…" : "Waiting for the card reader…"}
                    </AppText>
                  </View>
                ) : card ? (
                  <>
                    <PrimaryButton title={`Tap to Pay ${chosen.amount}`} icon="wifi" onPress={() => takeByCard("phone")} />
                    <Choice icon="hardware-chip-outline" label="Card reader" detail="A Bluetooth reader switched on near your phone." disabled={!!busy} onPress={() => takeByCard("reader")} />
                  </>
                ) : (
                  <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, padding: 14 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }}>
                      Tap to Pay or card reader
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>
                      {context.on ? "Works in the MPE app on your phone, once it's set up." : "Card payments start once Stripe is connected."}
                    </AppText>
                  </View>
                )}

                {context.savedCard && context.on && (
                  <Choice
                    icon="card-outline"
                    label={busy === "charge" ? "Charging…" : `Charge their ${context.savedCard.brand} ending ${context.savedCard.last4}`}
                    detail="The card they saved with MPE. Check with them first."
                    disabled={!!busy}
                    onPress={chargeCard}
                  />
                )}
                {context.on && (
                  <Choice
                    icon="paper-plane-outline"
                    label={busy === "resend" ? "Sending…" : "Send the payment link"}
                    detail="To their chat, by text and email. They can pay with Apple Pay there and then."
                    disabled={!!busy}
                    onPress={sendLink}
                  />
                )}

                {cash === null ? (
                  <Choice
                    icon="cash-outline"
                    label="Cash"
                    detail="All of it, or part and the rest by card or the link."
                    disabled={!!busy}
                    onPress={() => {
                      setCash((chosen.amountPence / 100).toFixed(2));
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
                    }}
                  />
                ) : (
                  <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, padding: 14, gap: 10 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }}>
                      How much cash?
                    </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 14 }}>
                      <AppText weight="bold" style={{ fontSize: 18, color: colors.text2 }}>
                        £
                      </AppText>
                      <TextInput
                        value={cash}
                        onChangeText={setCash}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Cash amount in pounds"
                        autoFocus
                        selectTextOnFocus
                        style={{ flex: 1, fontSize: 20, fontFamily: fonts.bold, color: colors.navy, paddingHorizontal: 6 }}
                      />
                    </View>
                    <AppText style={{ color: colors.text2, fontSize: 13 }}>
                      {cashPence && cashPence < chosen.amountPence
                        ? `${money(chosen.amountPence - cashPence)} left to take by card or the link.`
                        : cashPence && cashPence > chosen.amountPence
                          ? `That's more than the ${chosen.amount} left.`
                          : "All of it: they'll get a receipt."}
                    </AppText>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <PressableScale onPress={() => setCash(null)} accessibilityLabel="Cancel" style={{ flex: 1 }}>
                        <View style={{ height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center" }}>
                          <AppText weight="bold" style={{ fontSize: 15 }}>
                            Cancel
                          </AppText>
                        </View>
                      </PressableScale>
                      <PressableScale onPress={takeCash} disabled={!!busy} accessibilityLabel="Record the cash" style={{ flex: 1 }}>
                        <View style={{ height: 48, borderRadius: 999, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                          <AppText weight="bold" style={{ color: "#fff", fontSize: 15 }}>
                            {busy === "cash" ? "Saving…" : "Record cash"}
                          </AppText>
                        </View>
                      </PressableScale>
                    </View>
                  </View>
                )}

                <PressableScale onPress={bankTransfer} disabled={!!busy} accessibilityLabel="Paid by bank transfer" style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
                  <AppText weight="semibold" style={{ color: colors.text2, fontSize: 14, textDecorationLine: "underline" }}>
                    Paid by bank transfer
                  </AppText>
                </PressableScale>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
