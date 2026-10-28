import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { CustomerPicker } from "@/components/customer-picker";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { reportSend, type WhatsAppHandoff } from "@/lib/whatsapp-handoff";
import { instalmentSchedule } from "@/lib/instalment-schedule";
import { colors, fonts } from "@/lib/theme";

type Context = {
  customer: { id: string; name: string; first: string | null };
  visit: { id: string; label: string } | null;
  where: string;
  boiler: string;
  defaultTitle: string;
  products: { id: string; name: string; pricePence: number }[];
  online: boolean;
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
const inputStyle = { height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, paddingHorizontal: 12, fontSize: 16, fontFamily: fonts.regular, color: colors.navy } as const;

function Label({ children }: { children: ReactNode }) {
  return (
    <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
      {children}
    </AppText>
  );
}

/**
 * Writing a quote (the website's, in the app): what it's for, a line per
 * part and the labour (his products are one tap), what's included, any
 * deposit to accept it, how long it's open, and whether the rest can be
 * paid monthly once the work's done. The total and what's left after the
 * deposit update as he types. Sent to their chat, the app and email.
 */
export default function NewQuote() {
  const params = useLocalSearchParams<{ visit?: string; customer?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(params.customer ?? null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { description: "", pounds: "" },
    { description: "Labour", pounds: "" },
  ]);
  const [details, setDetails] = useState("");
  const [deposit, setDeposit] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [monthlyOn, setMonthlyOn] = useState(false);
  const [months, setMonths] = useState(6);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!params.visit && !customerId) return;
    setError(null);
    try {
      const c = await apiFetch<Context>(`/api/mobile/staff/quotes/new?${params.visit ? `visit=${params.visit}` : `customer=${customerId}`}`);
      setCtx(c);
      setTitle(c.defaultTitle);
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
  const depositPence = toPence(deposit);
  const rest = total - depositPence;
  const schedule = monthlyOn && rest >= 100 ? instalmentSchedule(rest, months, 0) : null;
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function send() {
    if (!ctx || saving) return;
    if (!title.trim()) return notify("Not finished", "Say what the quote's for.");
    if (!(parsed.length > 0 && parsed.every((l) => l.description && l.amountPence !== 0) && total >= 100)) return notify("Not finished", "Each line needs a description and an amount, and the total at least £1.");
    if (depositPence >= total) return notify("The deposit", "The deposit needs to be less than the total.");
    if (schedule && !schedule.ok) return notify("Monthly payments", schedule.error);
    setSaving(true);
    try {
      const res = await apiPost<{ id: string; message: string; whatsapp?: WhatsAppHandoff | null }>("/api/mobile/staff/quotes/new", {
        customerId: ctx.customer.id,
        appointmentId: ctx.visit?.id ?? null,
        title,
        lines: parsed,
        depositPence,
        details,
        validDays,
        balanceInstalments: monthlyOn ? months : null,
      });
      haptic.success();
      router.replace(`/quote/${res.id}`);
      await reportSend("Quote sent", res);
    } catch (err) {
      haptic.warning();
      notify("Not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!params.visit && !customerId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <ScreenHeader title="New quote" />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Label>Who&apos;s it for?</Label>
          <CustomerPicker onPick={(c) => setCustomerId(c.id)} onNew={(typed) => router.push(`/customer-form?then=quote&name=${encodeURIComponent(typed)}`)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="New quote" />
      {error && !ctx ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !ctx ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={300} radius={20} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 18 }} keyboardShouldPersistTaps="handled">
            <Card style={{ gap: 4 }}>
              <AppText weight="bold" style={{ fontSize: 16 }}>
                {ctx.customer.name}
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 13 }}>{ctx.visit?.label ?? ctx.where}</AppText>
              {ctx.boiler ? <AppText style={{ color: colors.text2, fontSize: 13 }}>Their boiler: {ctx.boiler}</AppText> : null}
            </Card>

            <View style={{ gap: 8 }}>
              <Label>The quote</Label>
              <Card style={{ gap: 10 }}>
                <TextInput value={title} onChangeText={setTitle} placeholder="What it's for, like “New combi boiler, fitted”" placeholderTextColor={colors.text3} accessibilityLabel="What it's for" style={inputStyle} />
                {lines.map((l, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <TextInput value={l.description} onChangeText={(v) => update(i, { description: v })} placeholder={i === 0 ? "Like “Combi boiler, 30kW”" : "Labour"} placeholderTextColor={colors.text3} accessibilityLabel={`Line ${i + 1} description`} style={[inputStyle, { flex: 1, minWidth: 0 }]} />
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
                      <PressableScale
                        key={p.id}
                        onPress={() =>
                          setLines((prev) => {
                            const empty = prev.findIndex((l) => !l.description.trim() && !l.pounds.trim());
                            const line = { description: p.name, pounds: (p.pricePence / 100).toString() };
                            return empty >= 0 ? prev.map((l, j) => (j === empty ? line : l)) : [...prev, line];
                          })
                        }
                        accessibilityLabel={`Add ${p.name}, ${money(p.pricePence)}`}
                        style={{ height: 38, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream }}
                      >
                        <AppText weight="semibold" style={{ fontSize: 13 }}>
                          + {p.name} {money(p.pricePence)}
                        </AppText>
                      </PressableScale>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.cream, borderRadius: 14, padding: 12 }}>
                  <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                    Total
                  </AppText>
                  <AppText weight="extrabold" style={{ fontSize: 24 }}>
                    {money(total)}
                  </AppText>
                </View>
                <TextInput value={details} onChangeText={setDetails} multiline placeholder="What's included: remove the old boiler, fit and commission the new one, flush the system, magnetic filter, register the warranty." placeholderTextColor={colors.text3} accessibilityLabel="What's included" style={[inputStyle, { minHeight: 100, height: undefined, paddingVertical: 12, textAlignVertical: "top" }]} />
              </Card>
            </View>

            <View style={{ gap: 8 }}>
              <Label>Accepting it</Label>
              <Card style={{ gap: 12 }}>
                <TextInput value={deposit} onChangeText={setDeposit} editable={ctx.online} placeholder={ctx.online ? "Deposit £ (or none)" : "A deposit needs online payments"} placeholderTextColor={colors.text3} keyboardType="decimal-pad" accessibilityLabel="Deposit in pounds" style={inputStyle} />
                {depositPence > 0 && (
                  <AppText style={{ color: depositPence >= total ? colors.danger : colors.text2, fontSize: 14 }}>
                    {depositPence >= total ? "The deposit needs to be less than the total." : `They pay ${money(depositPence)} to accept it, and ${money(rest)} when the work's done.`}
                  </AppText>
                )}
                <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2 }}>
                  Open for
                </AppText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[14, 30, 60, 90].map((d) => (
                    <PressableScale key={d} onPress={() => setValidDays(d)} accessibilityLabel={`${d} days${validDays === d ? ", selected" : ""}`} style={{ flex: 1 }}>
                      <View style={{ height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: validDays === d ? colors.navy : colors.cream, borderWidth: 1, borderColor: validDays === d ? colors.navy : colors.edge }}>
                        <AppText weight="bold" style={{ color: validDays === d ? "#fff" : colors.navy }}>
                          {d} days
                        </AppText>
                      </View>
                    </PressableScale>
                  ))}
                </View>
                {ctx.online && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <AppText weight="bold" style={{ fontSize: 15 }}>
                          The rest monthly
                        </AppText>
                        <AppText style={{ color: colors.text2, fontSize: 13 }}>Once the work's done, interest-free.</AppText>
                      </View>
                      <Switch value={monthlyOn} onValueChange={setMonthlyOn} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel="Let them pay the rest monthly" />
                    </View>
                    {monthlyOn && (
                      <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                            <PressableScale key={n} onPress={() => setMonths(n)} accessibilityLabel={`${n} months${months === n ? ", selected" : ""}`} style={{ width: 52, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: months === n ? colors.navy : colors.cream, borderWidth: 1, borderColor: months === n ? colors.navy : colors.edge }}>
                              <AppText weight="bold" style={{ color: months === n ? "#fff" : colors.navy }}>
                                {n}
                              </AppText>
                            </PressableScale>
                          ))}
                        </ScrollView>
                        <AppText style={{ color: schedule && !schedule.ok ? colors.danger : colors.text2, fontSize: 14 }}>
                          {!schedule ? "Add the lines first." : schedule.ok ? `About ${money(schedule.schedule.monthlyPence)} a month for ${months} months.` : schedule.error}
                        </AppText>
                      </>
                    )}
                  </>
                )}
              </Card>
            </View>
          </ScrollView>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
            <PrimaryButton title={saving ? "Sending…" : `Send ${ctx.customer.first ?? "them"} the quote, ${money(total)}`} icon="paper-plane" onPress={send} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
