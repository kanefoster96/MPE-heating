import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { MonthGrid, bareMonth } from "@/components/month-grid";
import { AppText, Card, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

type Kind = { key: string; label: string; minutes: number };
type Draft = {
  id: string | null;
  status: string | null;
  kind: string;
  day: string;
  start: string;
  end: string;
  title: string;
  address: string;
  postcode: string;
  notes: string;
  customer: { id: string; label: string } | null;
  enquiryId: string | null;
  change: { day: string; label: string; start: string; end: string; note: string | null } | null;
  asked: string | null;
};
type Option = { id: string; label: string; sub: string; address: string; postcode: string };

const PRESETS = [
  { label: "Morning", start: "08:00", end: "12:00" },
  { label: "Afternoon", start: "12:00", end: "17:00" },
  { label: "All day", start: "08:00", end: "17:00" },
];
// Every half hour, 7am to 7pm.
const TIMES = Array.from({ length: 25 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 7 * 60), 19 * 60);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
}
function longDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function Label({ children }: { children: ReactNode }) {
  return (
    <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
      {children}
    </AppText>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, autoCapitalize }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: "default" | "phone-pad" | "email-address"; autoCapitalize?: "none" | "words" | "sentences" | "characters" }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2, marginLeft: 4 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        style={{ minHeight: multiline ? 88 : 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}${on ? ", selected" : ""}`} style={{ height: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.navy : colors.card, borderWidth: 1, borderColor: on ? colors.navy : colors.edge }}>
      <AppText weight="semibold" style={{ color: on ? "#fff" : colors.navy, fontSize: 14 }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** A row of times to pick from, scrolled to the chosen one. */
function TimeRow({ label, value, onPick, after }: { label: string; value: string; onPick: (t: string) => void; after?: string }) {
  const ref = useRef<ScrollView>(null);
  const options = after ? TIMES.filter((t) => t > after) : TIMES;
  const index = Math.max(0, options.indexOf(value));
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, index * 76 - 100), animated: false }), 50);
    return () => clearTimeout(timer);
  }, [index]);
  return (
    <View style={{ gap: 6 }}>
      <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2, marginLeft: 4 }}>
        {label}: {clock(value)}
      </AppText>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((t) => (
          <PressableScale key={t} onPress={() => onPick(t)} accessibilityLabel={`${label} ${clock(t)}${t === value ? ", selected" : ""}`} style={{ width: 70, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t === value ? colors.orangeDeep : colors.card, borderWidth: 1, borderColor: t === value ? colors.orangeDeep : colors.edge }}>
            <AppText weight="bold" style={{ fontSize: 14, color: t === value ? "#fff" : colors.navy }}>
              {clock(t)}
            </AppText>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Add a visit, or change one (move it, answer a request): the website's
 * schedule form, in the app. Who (a customer found by name, number or
 * postcode, or a new one), what kind, which day (a calendar) and when
 * (morning, afternoon, all day, or exact times), where, and notes. "Let
 * them know" sends them the booking or the new time, as the website does.
 */
export default function VisitForm() {
  const params = useLocalSearchParams<{ id?: string; customer?: string; day?: string; conversation?: string; usechange?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifyThem, setNotifyThem] = useState(true);
  const [picking, setPicking] = useState(false);
  const [pickMonth, setPickMonth] = useState<string>("");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [fresh, setFresh] = useState<{ name: string; phone: string; email: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = params.id ? `id=${params.id}` : `${params.customer ? `customer=${params.customer}&` : ""}${params.day ? `day=${params.day}` : ""}`;
      const res = await apiFetch<{ draft: Draft; kinds: Kind[] }>(`/api/mobile/staff/schedule/visit?${q}`);
      const d = res.draft;
      // "Move to when they asked": the form opens on it.
      setDraft(params.usechange && d.change ? { ...d, day: d.change.day, start: d.change.start, end: d.change.end } : d);
      setKinds(res.kinds);
      setPickMonth((params.usechange && d.change ? d.change.day : d.day).slice(0, 7));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that.");
    }
  }, [params.id, params.customer, params.day, params.usechange]);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  // The customer search, as he types.
  useEffect(() => {
    if (!draft || draft.customer || fresh) return;
    const timer = setTimeout(async () => {
      try {
        setOptions((await apiFetch<{ customers: Option[] }>(`/api/mobile/staff/customers?q=${encodeURIComponent(search.trim())}`)).customers);
      } catch {
        setOptions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, draft, fresh]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function pickKind(k: Kind) {
    if (!draft) return;
    // The usual length for the kind, from the same start.
    set({ kind: k.key, end: fromMinutes(toMinutes(draft.start) + k.minutes) });
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const res = await apiPost<{ id: string; day: string; message: string }>("/api/mobile/staff/schedule/visit", {
        id: draft.id,
        kind: draft.kind,
        day: draft.day,
        start: draft.start,
        end: draft.end,
        title: draft.title,
        address: draft.address,
        postcode: draft.postcode,
        notes: draft.notes,
        customerId: draft.customer?.id ?? null,
        enquiryId: draft.enquiryId,
        conversationId: params.conversation ?? null,
        newCustomer: draft.customer ? null : fresh,
        notify: notifyThem,
      });
      haptic.success();
      notify(draft.id ? "Saved" : "Booked", res.message);
      router.replace(`/job/${res.id}`);
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasCustomer = !!draft?.customer || !!(fresh && (fresh.name || fresh.phone || fresh.email));
  const title = !draft ? "Visit" : !draft.id ? "Add a visit" : draft.status === "requested" ? "Book their request" : "Change the visit";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={title} />
      {error && !draft ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !draft ? (
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={200} radius={20} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 18 }} keyboardShouldPersistTaps="handled">
            {draft.change && (
              <Card style={{ gap: 8, borderColor: colors.orangeDeep }}>
                <AppText weight="bold" style={{ fontSize: 15 }}>
                  They asked to move it to {draft.change.label}
                </AppText>
                {draft.change.note ? <AppText style={{ color: colors.text2, fontSize: 14 }}>&ldquo;{draft.change.note}&rdquo;</AppText> : null}
                <PressableScale onPress={() => set({ day: draft.change!.day, start: draft.change!.start, end: draft.change!.end })} accessibilityLabel="Use the time they asked for" style={{ alignSelf: "flex-start", height: 40, justifyContent: "center" }}>
                  <AppText weight="bold" style={{ color: colors.orangeDeep }}>
                    Use that time
                  </AppText>
                </PressableScale>
              </Card>
            )}
            {draft.asked && (
              <Card style={{ gap: 4, borderColor: colors.orangeDeep }}>
                <AppText weight="bold" style={{ fontSize: 15 }}>
                  They asked for {draft.asked}
                </AppText>
                <AppText style={{ color: colors.text2, fontSize: 14 }}>Pick the time you can do. Saving books it.</AppText>
              </Card>
            )}

            {/* Who. */}
            <View style={{ gap: 8 }}>
              <Label>Customer</Label>
              {draft.customer ? (
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Ionicons name="person" size={20} color={colors.orangeDeep} />
                  <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                    {draft.customer.label}
                  </AppText>
                  <PressableScale onPress={() => set({ customer: null })} accessibilityLabel="Change the customer" style={{ height: 40, justifyContent: "center", paddingLeft: 12 }}>
                    <AppText weight="semibold" style={{ color: colors.orangeDeep }}>
                      Change
                    </AppText>
                  </PressableScale>
                </Card>
              ) : fresh ? (
                <Card style={{ gap: 10 }}>
                  <Field label="Name" value={fresh.name} onChange={(v) => setFresh({ ...fresh, name: v })} autoCapitalize="words" />
                  <Field label="Mobile" value={fresh.phone} onChange={(v) => setFresh({ ...fresh, phone: v })} keyboardType="phone-pad" />
                  <Field label="Email" value={fresh.email} onChange={(v) => setFresh({ ...fresh, email: v })} keyboardType="email-address" autoCapitalize="none" />
                  <PressableScale onPress={() => setFresh(null)} accessibilityLabel="Find an existing customer instead" style={{ height: 40, justifyContent: "center" }}>
                    <AppText weight="semibold" style={{ color: colors.orangeDeep }}>
                      Find an existing customer instead
                    </AppText>
                  </PressableScale>
                </Card>
              ) : (
                <Card style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", height: 48, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 14, gap: 8 }}>
                    <Ionicons name="search" size={18} color={colors.text3} />
                    <TextInput value={search} onChangeText={setSearch} placeholder="Name, number or postcode" placeholderTextColor={colors.text3} accessibilityLabel="Find a customer" style={{ flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.navy }} />
                  </View>
                  {options.slice(0, 6).map((o) => (
                    <PressableScale key={o.id} onPress={() => set({ customer: { id: o.id, label: o.label }, address: draft.address || o.address, postcode: draft.postcode || o.postcode })} accessibilityLabel={`${o.label}, ${o.sub}`}>
                      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
                        <AppText weight="semibold" style={{ fontSize: 15 }}>
                          {o.label}
                        </AppText>
                        {o.sub ? <AppText style={{ color: colors.text2, fontSize: 13 }}>{o.sub}</AppText> : null}
                      </View>
                    </PressableScale>
                  ))}
                  <PressableScale onPress={() => setFresh({ name: search.trim(), phone: "", email: "" })} accessibilityLabel="Add a new customer" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="person-add" size={18} color={colors.orangeDeep} />
                    <AppText weight="bold" style={{ color: colors.orangeDeep }}>
                      New customer
                    </AppText>
                  </PressableScale>
                </Card>
              )}
            </View>

            {/* What. */}
            <View style={{ gap: 8 }}>
              <Label>What</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {kinds.map((k) => (
                  <Chip key={k.key} label={k.label} on={draft.kind === k.key} onPress={() => pickKind(k)} />
                ))}
              </View>
              <Field label="Title (optional)" value={draft.title} onChange={(v) => set({ title: v })} placeholder={hasCustomer ? "Like “No hot water”" : "Needed if there's no customer"} />
            </View>

            {/* When. */}
            <View style={{ gap: 10 }}>
              <Label>When</Label>
              <PressableScale onPress={() => setPicking((v) => !v)} accessibilityLabel={`Day: ${longDay(draft.day)}. Change it`}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Ionicons name="calendar" size={20} color={colors.orangeDeep} />
                  <AppText weight="bold" style={{ flex: 1, fontSize: 16 }}>
                    {longDay(draft.day)}
                  </AppText>
                  <Ionicons name={picking ? "chevron-up" : "chevron-down"} size={18} color={colors.text3} />
                </Card>
              </PressableScale>
              {picking && (
                <Card style={{ paddingHorizontal: 8 }}>
                  <MonthGrid
                    month={pickMonth}
                    days={bareMonth(pickMonth)}
                    today={today}
                    selected={draft.day}
                    past={false}
                    onPick={(d) => {
                      set({ day: d });
                      setPicking(false);
                    }}
                    onMonth={setPickMonth}
                  />
                </Card>
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PRESETS.map((p) => (
                  <Chip key={p.label} label={p.label} on={draft.start === p.start && draft.end === p.end} onPress={() => set({ start: p.start, end: p.end })} />
                ))}
              </View>
              <TimeRow
                label="From"
                value={draft.start}
                onPick={(t) => {
                  // Keeps the same length, moved.
                  const length = toMinutes(draft.end) - toMinutes(draft.start);
                  set({ start: t, end: fromMinutes(toMinutes(t) + Math.max(30, length)) });
                }}
              />
              <TimeRow label="Until" value={draft.end} after={draft.start} onPick={(t) => set({ end: t })} />
            </View>

            {/* Where. */}
            <View style={{ gap: 8 }}>
              <Label>Where</Label>
              <Field label="Address" value={draft.address} onChange={(v) => set({ address: v })} autoCapitalize="words" />
              <Field label="Postcode" value={draft.postcode} onChange={(v) => set({ postcode: v })} autoCapitalize="characters" />
            </View>

            <View style={{ gap: 8 }}>
              <Label>Notes</Label>
              <Field label="Notes for the visit" value={draft.notes} onChange={(v) => set({ notes: v })} multiline placeholder="The key safe, parking, what to bring…" />
            </View>

            {hasCustomer && (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 15 }}>
                    Let them know
                  </AppText>
                  <AppText style={{ color: colors.text2, fontSize: 13 }}>{draft.id ? "If it's booked or moved: by text, email and their chat." : "Their booking, by text, email and their chat."}</AppText>
                </View>
                <Switch value={notifyThem} onValueChange={setNotifyThem} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel="Let them know" />
              </Card>
            )}
          </ScrollView>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
            <PrimaryButton title={saving ? "Saving…" : !draft.id || draft.status === "requested" ? `Book for ${clock(draft.start)}, ${longDay(draft.day).split(" ").slice(0, 3).join(" ")}` : "Save changes"} icon="checkmark" onPress={save} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
