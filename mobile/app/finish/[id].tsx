import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { FileAdder } from "@/components/file-adder";
import { ImageViewer } from "@/components/image-viewer";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { openExternal } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";

type Draft = {
  id: string;
  title: string;
  when: string;
  done: boolean;
  hasCustomer: boolean;
  customerId: string | null;
  first: string | null;
  report: string;
  boiler: { boilerMake: string; boilerModel: string; boilerAge: string; boilerLocation: string };
  servicedToday: boolean;
  sendSummary: boolean;
  askReview: boolean;
  reviewed: string | null;
  payments: { label: string; amount: string; paid: boolean }[];
  files: { id: string; kind: string; label: string; url: string | null; image: boolean; shared: boolean; expiresOn: string | null }[];
  certTypes: { key: string; label: string }[];
  today: string;
};

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

function Input({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2, marginLeft: 4 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        accessibilityLabel={label}
        style={{ minHeight: multiline ? 110 : 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function Toggle({ title, detail, value, onChange, disabled }: { title: string; detail: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: disabled ? 0.6 : 1 }}>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 15 }}>
          {title}
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>{detail}</AppText>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );
}

/**
 * Finishing a job (the website's Finish job, in the app): what was done,
 * which the customer sees; their boiler; serviced today (their reminder
 * comes in 11 months); a private note for next time; the summary to them
 * and the review ask; and photos and certificates for the job. Opened
 * again later, it edits what was saved.
 */
export default function FinishJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [d, setD] = useState<Draft | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(
    async (keep = false) => {
      setError(null);
      try {
        const fresh = await apiFetch<Draft>(`/api/mobile/staff/jobs/${id}/finish`);
        // After adding a photo, keep what's been typed.
        setD((current) => (keep && current ? { ...current, files: fresh.files } : fresh));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open that job.");
      }
    },
    [id],
  );

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));

  async function save() {
    if (!d || saving) return;
    setSaving(true);
    try {
      const res = await apiPost<{ message: string }>(`/api/mobile/staff/jobs/${d.id}/finish`, {
        report: d.report,
        privateNote: note,
        boiler: d.boiler,
        servicedToday: d.servicedToday,
        sendSummary: d.sendSummary,
        askReview: d.askReview,
      });
      haptic.success();
      notify(d.done ? "Saved" : "Job done", res.message);
      router.back();
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const first = d?.first ?? "them";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={d?.done ? "Job done" : "Finish job"} />
      {error && !d ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={() => load()} />
        </View>
      ) : !d ? (
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={90} radius={20} />
          <Skeleton height={160} radius={20} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 18 }} keyboardShouldPersistTaps="handled">
            <View style={{ paddingHorizontal: 4 }}>
              <AppText weight="extrabold" style={{ fontSize: 24 }}>
                {d.title}
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 14 }}>{d.when}</AppText>
              {d.payments.map((p) => (
                <AppText key={p.label} style={{ fontSize: 14, marginTop: 4 }}>
                  {p.label} {p.amount} · <AppText weight="bold" style={{ color: p.paid ? colors.success : colors.orangeDeep, fontSize: 14 }}>{p.paid ? "Paid" : "Not paid yet"}</AppText>
                </AppText>
              ))}
              {d.reviewed && <AppText style={{ marginTop: 6, fontSize: 14 }}>{d.reviewed}</AppText>}
            </View>

            <View style={{ gap: 8 }}>
              <Label hint={d.hasCustomer ? `${first === "them" ? "They see" : `${first} sees`} this on their visit page and account.` : "For the record."}>What we did</Label>
              <Input label="What we did" value={d.report} onChange={(v) => set({ report: v })} multiline placeholder="Replaced the diverter valve, topped the pressure up to 1.2 bar, tested heating and hot water." />
            </View>

            {d.hasCustomer && (
              <>
                <View style={{ gap: 8 }}>
                  <Label>Their boiler</Label>
                  <Card style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Input label="Make" value={d.boiler.boilerMake} onChange={(v) => set({ boiler: { ...d.boiler, boilerMake: v } })} />
                      <Input label="Model" value={d.boiler.boilerModel} onChange={(v) => set({ boiler: { ...d.boiler, boilerModel: v } })} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Input label="Roughly how old" value={d.boiler.boilerAge} onChange={(v) => set({ boiler: { ...d.boiler, boilerAge: v } })} />
                      <Input label="Where it is" value={d.boiler.boilerLocation} onChange={(v) => set({ boiler: { ...d.boiler, boilerLocation: v } })} />
                    </View>
                    <Toggle title="Serviced on this visit" detail="Sets “last serviced”. Their reminder comes in 11 months." value={d.servicedToday} onChange={(v) => set({ servicedToday: v })} />
                  </Card>
                </View>

                <View style={{ gap: 8 }}>
                  <Label hint="Only the team see this. Optional.">Note for next time</Label>
                  <Input label="Note for next time" value={note} onChange={setNote} multiline placeholder="Heat exchanger showing wear. Mention a replacement quote at the next service." />
                </View>

                <Card style={{ gap: 14 }}>
                  <Toggle title={`Send ${first} a summary`} detail="What we did, with their invoice or receipt. By message, email, text and the app." value={d.sendSummary} onChange={(v) => set({ sendSummary: v })} />
                  <Toggle
                    title={`Ask ${first} for a review`}
                    detail={d.reviewed ? "They've already reviewed this job." : "Goes about two hours from now (daytime only), with one reminder after three days."}
                    value={d.askReview}
                    onChange={(v) => set({ askReview: v })}
                    disabled={!!d.reviewed}
                  />
                </Card>

                <View style={{ gap: 8 }}>
                  <Label hint="The finished work, the gas safety record or Benchmark. Saved with the job and the customer.">Photos and certificates</Label>
                  {d.files.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {d.files.map((f) =>
                        f.image && f.url ? (
                          <PressableScale key={f.id} onPress={() => setViewing(f.url)} accessibilityLabel={`Open ${f.label}`}>
                            <Image source={{ uri: f.url }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: colors.grey }} accessibilityIgnoresInvertColors />
                          </PressableScale>
                        ) : (
                          <PressableScale key={f.id} onPress={() => f.url && openExternal(f.url)} accessibilityLabel={`Open ${f.label}`}>
                            <View style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center", padding: 6, gap: 4 }}>
                              <Ionicons name="document-text" size={26} color={colors.orangeDeep} />
                              <AppText style={{ fontSize: 11, textAlign: "center" }} numberOfLines={2}>
                                {f.label}
                              </AppText>
                            </View>
                          </PressableScale>
                        ),
                      )}
                    </View>
                  )}
                  {d.customerId && <FileAdder customerId={d.customerId} appointmentId={d.id} today={d.today} certTypes={d.certTypes} onAdded={() => load(true)} />}
                </View>
              </>
            )}
          </ScrollView>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
            <PrimaryButton title={saving ? "Saving…" : d.done ? "Save" : "Mark job done"} icon="checkmark-done" onPress={save} />
          </View>
        </KeyboardAvoidingView>
      )}
      <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}
