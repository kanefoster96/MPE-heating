import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { CustomerPicker } from "@/components/customer-picker";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { reportSend, type WhatsAppHandoff } from "@/lib/whatsapp-handoff";
import { instalmentSchedule, scheduleSummary } from "@/lib/instalment-schedule";
import { colors, fonts } from "@/lib/theme";
import type { SheetContext } from "@/lib/types";

type Context = {
  customer: { id: string; name: string; first: string | null };
  visit: { id: string; label: string } | null;
  online: boolean;
  savedCard: { brand: string; last4: string } | null;
  onPlan: string | null;
  callout: { pence: number; label: string } | null;
  creditPence: number;
  defaultDescription: string;
  repair: boolean;
  products: { id: string; name: string; pricePence: number }[];
  upsells: { productId: string; label: string; usualPence: number; offerPence: number }[];
  credits: { id: string; label: string; pence: number }[];
  months: { min: number; max: number };
};
type Line = { description: string; pounds: string };

function toPence(pounds: string): number {
  const n = Number(pounds.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function money(pence: number): string {
  const sign = pence < 0 ? "−" : "";
  const pounds = Math.abs(pence) / 100;
  return `${sign}£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2)}`;
}

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={{ marginLeft: 4, gap: 2 }}>
      <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" }}>
        {children}
      </AppText>
      {hint ? <AppText style={{ color: colors.text3, fontSize: 13 }}>{hint}</AppText> : null}
    </View>
  );
}

const inputStyle = { height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, paddingHorizontal: 12, fontSize: 16, fontFamily: fonts.regular, color: colors.navy } as const;

export default function NewPaymentScreen() {
  return (
    <TapToPayProvider>
      <NewPayment />
    </TapToPayProvider>
  );
}

/**
 * A new invoice or call-out fee (the website's take-payment page, in the
 * app). The call-out fee, unless they're on the plan or one's been asked
 * for. The invoice: a line per part or job (a minus is money off, like the
 * call-out fee they paid), his products as one-tap lines, money they're
 * owed from a referral, extras offered on their pay page, and paying
 * monthly. Then "Send to them" (their chat, the app and email) or "Take
 * payment now" (the Payment sheet: Tap to Pay, card reader, saved card,
 * cash, all or part).
 */
function NewPayment() {
  const params = useLocalSearchParams<{ visit?: string; customer?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(params.customer ?? null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [offers, setOffers] = useState<(Context["upsells"][number] & { on: boolean; price: string })[]>([]);
  const [monthlyOn, setMonthlyOn] = useState(false);
  const [months, setMonths] = useState(6);
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; context: SheetContext } | null>(null);

  const load = useCallback(async () => {
    if (!params.visit && !customerId) return;
    setError(null);
    try {
      const c = await apiFetch<Context>(`/api/mobile/staff/payments/new?${params.visit ? `visit=${params.visit}` : `customer=${customerId}`}`);
      setCtx(c);
      setDescription(c.defaultDescription);
      setLines([{ description: "Labour", pounds: "" }, { description: "", pounds: "" }, ...(c.creditPence > 0 ? [{ description: "Call-out fee already paid", pounds: (-c.creditPence / 100).toString() }] : [])]);
      setOffers(c.upsells.map((o) => ({ ...o, on: c.repair, price: (o.offerPence / 100).toString() })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that.");
    }
  }, [params.visit, customerId]);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const parsed = lines.map((l) => ({ description: l.description.trim(), amountPence: toPence(l.pounds) })).filter((l) => l.description || l.amountPence);
  const total = parsed.reduce((sum, l) => sum + l.amountPence, 0);
  const complete = parsed.length > 0 && parsed.every((l) => l.description && l.amountPence !== 0) && total >= 100;
  const schedule = monthlyOn && total >= 100 ? instalmentSchedule(total, months, toPence(deposit)) : null;
  const creditIds = (ctx?.credits ?? []).filter((c) => lines.some((l) => l.description === c.label && toPence(l.pounds) === -c.pence)).map((c) => c.id);
  const first = ctx?.customer.first ?? "them";

  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = (line: Line) =>
    setLines((prev) => {
      const empty = prev.findIndex((l) => !l.description.trim() && !l.pounds.trim());
      return empty >= 0 ? prev.map((l, j) => (j === empty ? line : l)) : [...prev, line];
    });

  async function submit(kind: "callout_fee" | "invoice", intent: "send" | "take") {
    if (!ctx || busy) return;
    if (kind === "invoice" && !complete) return notify("Not finished", "Each line needs a description and an amount, and the total at least £1.");
    if (kind === "invoice" && schedule && !schedule.ok) return notify("Monthly payments", schedule.error);
    setBusy(`${kind}-${intent}`);
    try {
      const res = await apiPost<{ id: string; message: string; whatsapp?: WhatsAppHandoff | null }>("/api/mobile/staff/payments/new", {
        customerId: ctx.customer.id,
        appointmentId: ctx.visit?.id ?? null,
        kind,
        description,
        lines: parsed,
        intent,
        offers: ctx.online ? offers.filter((o) => o.on && toPence(o.price) >= 100).map((o) => ({ productId: o.productId, label: o.label, pence: toPence(o.price), usualPence: o.usualPence })) : [],
        instalments: monthlyOn ? { months, depositPence: toPence(deposit) } : null,
        creditIds,
      });
      haptic.success();
      if (intent === "send") {
        router.back();
        await reportSend("Sent", res);
      } else {
        setSheet({ id: res.id, context: await apiFetch<SheetContext>(`/api/mobile/staff/payments/${res.id}`) });
      }
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Who it's for, first.
  if (!params.visit && !customerId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <ScreenHeader title="New payment" />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Label>Who&apos;s it for?</Label>
          <CustomerPicker onPick={(c) => setCustomerId(c.id)} onNew={(typed) => router.push(`/customer-form?then=payment&name=${encodeURIComponent(typed)}`)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="New payment" />
      {error && !ctx ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !ctx ? (
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={80} radius={20} />
          <Skeleton height={240} radius={20} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 190, gap: 18 }} keyboardShouldPersistTaps="handled">
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="person" size={20} color={colors.orangeDeep} />
              <View style={{ flex: 1 }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  {ctx.customer.name}
                </AppText>
                {ctx.visit && <AppText style={{ color: colors.text2, fontSize: 13 }}>{ctx.visit.label}</AppText>}
              </View>
              {!params.visit && (
                <PressableScale onPress={() => { setCustomerId(null); setCtx(null); }} accessibilityLabel="Change the customer" style={{ height: 40, justifyContent: "center", paddingLeft: 12 }}>
                  <AppText weight="semibold" style={{ color: colors.orangeDeep }}>
                    Change
                  </AppText>
                </PressableScale>
              )}
            </Card>
            {ctx.savedCard && <AppText style={{ color: colors.success, fontSize: 14, marginLeft: 4 }}>Card on file: {ctx.savedCard.brand} ending {ctx.savedCard.last4}</AppText>}
            {ctx.onPlan && (
              <View style={{ flexDirection: "row", gap: 8, backgroundColor: "#e5f3ea", borderRadius: 16, padding: 12 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <AppText style={{ flex: 1, color: colors.success, fontSize: 14 }}>{ctx.onPlan}</AppText>
              </View>
            )}

            {ctx.callout && (
              <View style={{ gap: 8 }}>
                <Label hint="If they go ahead with the repair, it comes off the invoice automatically.">Call-out fee</Label>
                <Card style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                      Call-out fee
                    </AppText>
                    <AppText weight="extrabold" style={{ fontSize: 20 }}>
                      {ctx.callout.label}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {ctx.online && (
                      <PressableScale onPress={() => submit("callout_fee", "send")} accessibilityLabel={`Send ${first} the call-out fee`} style={{ flex: 1 }}>
                        <View style={{ height: 48, borderRadius: 999, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center" }}>
                          <AppText weight="bold" style={{ color: "#fff" }}>
                            {busy === "callout_fee-send" ? "Sending…" : "Send it"}
                          </AppText>
                        </View>
                      </PressableScale>
                    )}
                    <PressableScale onPress={() => submit("callout_fee", "take")} accessibilityLabel="Take the call-out fee now" style={{ flex: 1 }}>
                      <View style={{ height: 48, borderRadius: 999, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                        <AppText weight="bold" style={{ color: "#fff" }}>
                          {busy === "callout_fee-take" ? "Saving…" : "Take it now"}
                        </AppText>
                      </View>
                    </PressableScale>
                  </View>
                </Card>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Label>Invoice for the job</Label>
              <Card style={{ gap: 10 }}>
                <TextInput value={description} onChangeText={setDescription} placeholder="What it's for" placeholderTextColor={colors.text3} accessibilityLabel="What it's for" style={inputStyle} />
                {lines.map((l, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <TextInput value={l.description} onChangeText={(v) => update(i, { description: v })} placeholder={i === 0 ? "Labour" : "Like “Diverter valve”"} placeholderTextColor={colors.text3} accessibilityLabel={`Line ${i + 1} description`} style={[inputStyle, { flex: 1, minWidth: 0 }]} />
                    <TextInput value={l.pounds} onChangeText={(v) => update(i, { pounds: v })} placeholder="£0" placeholderTextColor={colors.text3} keyboardType="numbers-and-punctuation" accessibilityLabel={`Line ${i + 1} amount in pounds`} style={[inputStyle, { width: 84, flexShrink: 0, textAlign: "right" }]} />
                    <PressableScale onPress={() => setLines((prev) => prev.filter((_, j) => j !== i))} accessibilityLabel={`Remove line ${i + 1}`} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="close" size={20} color={colors.text3} />
                    </PressableScale>
                  </View>
                ))}
                <PressableScale onPress={() => setLines((prev) => [...prev, { description: "", pounds: "" }])} accessibilityLabel="Add a line" style={{ height: 40, justifyContent: "center", alignSelf: "flex-start" }}>
                  <AppText weight="bold" style={{ color: colors.orangeDeep }}>
                    + Add a line
                  </AppText>
                </PressableScale>
                {ctx.products.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {ctx.products.map((p) => (
                      <PressableScale key={p.id} onPress={() => addLine({ description: p.name, pounds: (p.pricePence / 100).toString() })} accessibilityLabel={`Add ${p.name}, ${money(p.pricePence)}`} style={{ height: 38, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream }}>
                        <AppText weight="semibold" style={{ fontSize: 13 }}>
                          + {p.name} {money(p.pricePence)}
                        </AppText>
                      </PressableScale>
                    ))}
                  </View>
                )}
                {ctx.credits.filter((c) => !creditIds.includes(c.id)).length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <AppText weight="bold" style={{ color: colors.success, fontSize: 13 }}>
                      They&apos;re owed:
                    </AppText>
                    {ctx.credits
                      .filter((c) => !creditIds.includes(c.id))
                      .map((c) => (
                        <PressableScale key={c.id} onPress={() => setLines((prev) => [...prev, { description: c.label, pounds: (-c.pence / 100).toString() }])} accessibilityLabel={`Take off ${c.label}, ${money(c.pence)}`} style={{ height: 38, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: "#e5f3ea" }}>
                          <AppText weight="bold" style={{ fontSize: 13, color: colors.success }}>
                            + {c.label} {money(-c.pence)}
                          </AppText>
                        </PressableScale>
                      ))}
                  </View>
                )}
                {ctx.creditPence > 0 && <AppText style={{ color: colors.text2, fontSize: 13 }}>The {money(ctx.creditPence)} call-out fee they paid comes off, as promised. Remove that line if it shouldn&apos;t.</AppText>}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.cream, borderRadius: 14, padding: 12 }}>
                  <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                    Total
                  </AppText>
                  <AppText weight="extrabold" style={{ fontSize: 24 }}>
                    {money(total)}
                  </AppText>
                </View>
              </Card>
            </View>

            {ctx.online && offers.length > 0 && (
              <View style={{ gap: 8 }}>
                <Label hint="They can tick these when they pay. You're already there, so they're about 20% off.">Offer on their pay page</Label>
                <Card style={{ gap: 12 }}>
                  {offers.map((o, i) => (
                    <View key={o.productId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Switch value={o.on} onValueChange={(v) => setOffers((prev) => prev.map((x, j) => (j === i ? { ...x, on: v } : x)))} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel={`Offer ${o.label}`} />
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold" style={{ fontSize: 15 }}>
                          {o.label}
                        </AppText>
                        <AppText style={{ color: colors.text3, fontSize: 12, textDecorationLine: "line-through" }}>{money(o.usualPence)}</AppText>
                      </View>
                      <TextInput value={o.price} onChangeText={(v) => setOffers((prev) => prev.map((x, j) => (j === i ? { ...x, price: v } : x)))} keyboardType="decimal-pad" accessibilityLabel={`${o.label} offer price in pounds`} style={[inputStyle, { width: 84, height: 44, textAlign: "right" }]} />
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {ctx.online && (
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }}>
                      Let them pay monthly
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 13 }}>Offered on their pay page next to paying in full. Nothing added.</AppText>
                  </View>
                  <Switch value={monthlyOn} onValueChange={setMonthlyOn} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel="Let them pay monthly" />
                </View>
                {monthlyOn && (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {Array.from({ length: ctx.months.max - ctx.months.min + 1 }, (_, i) => i + ctx.months.min).map((n) => (
                        <PressableScale key={n} onPress={() => setMonths(n)} accessibilityLabel={`${n} months${months === n ? ", selected" : ""}`} style={{ width: 56, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: months === n ? colors.navy : colors.cream, borderWidth: 1, borderColor: months === n ? colors.navy : colors.edge }}>
                          <AppText weight="bold" style={{ color: months === n ? "#fff" : colors.navy }}>
                            {n}
                          </AppText>
                        </PressableScale>
                      ))}
                    </ScrollView>
                    <TextInput value={deposit} onChangeText={setDeposit} placeholder="Deposit £ (optional)" placeholderTextColor={colors.text3} keyboardType="decimal-pad" accessibilityLabel="Deposit in pounds" style={inputStyle} />
                    <AppText style={{ color: schedule && !schedule.ok ? colors.danger : colors.text2, fontSize: 14 }}>
                      {!schedule ? "Add the lines first." : schedule.ok ? `They can choose: ${scheduleSummary(schedule.schedule, money)}.` : schedule.error}
                    </AppText>
                  </>
                )}
              </Card>
            )}
          </ScrollView>

          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
            {ctx.online && <PrimaryButton title={busy === "invoice-send" ? "Sending…" : `Send ${first} the invoice, ${money(total)}`} icon="paper-plane" onPress={() => submit("invoice", "send")} />}
            <PressableScale onPress={() => submit("invoice", "take")} accessibilityLabel="Take payment now">
              <View style={{ height: 52, borderRadius: 999, backgroundColor: colors.navy, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="card" size={18} color="#fff" />
                <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
                  {busy === "invoice-take" ? "Saving…" : "Take payment now"}
                </AppText>
              </View>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      )}
      {sheet && (
        <PaymentSheet
          visible
          context={sheet.context}
          onClose={() => {
            setSheet(null);
            router.back();
          }}
          onDone={async () => {
            // Part paid: what's left. Paid in full: it's gone from the open ones.
            try {
              setSheet({ id: sheet.id, context: await apiFetch<SheetContext>(`/api/mobile/staff/payments/${sheet.id}`) });
            } catch {
              setSheet(null);
              router.back();
            }
          }}
        />
      )}
    </View>
  );
}
