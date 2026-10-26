import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { PaymentSheet } from "@/components/payment-sheet";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { openDirections, openExternal, openSignedIn } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";
import type { CustomerVisit, StaffCustomer } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A customer, for the team: everything about them in one place, from
 * their name at the top of a chat (Kanvas Academy's contact card). Call,
 * message, directions; jobs underway (each opens its job page to move,
 * finish or take payment); what they owe, taken from here; the team's
 * private notes, with a new one; their boiler; and what's been done
 * before. Book a visit, invoice or quote on the website, opened signed in.
 */
export default function CustomerScreen() {
  return (
    <TapToPayProvider>
      <Customer />
    </TapToPayProvider>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" }}>
          {title}
        </AppText>
        {right}
      </View>
      {children}
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ height: 64, borderRadius: 18, backgroundColor: colors.grey, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name={icon} size={20} color={colors.navy} />
        <AppText weight="semibold" style={{ fontSize: 12 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

function Row({ icon, label, value, onPress, last }: { icon: IconName; label: string; value: string; onPress?: () => void; last?: boolean }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
      <Ionicons name={icon} size={18} color={colors.text2} />
      <View style={{ flex: 1 }}>
        <AppText style={{ color: colors.text2, fontSize: 12 }}>{label}</AppText>
        <AppText weight="semibold" style={{ fontSize: 15 }}>
          {value}
        </AppText>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.text3} />}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}

const STATUS_TONE: Record<string, { bg: string; ink: string }> = {
  Booked: { bg: colors.grey, ink: colors.navy },
  Requested: { bg: colors.orangeLight, ink: colors.orangeDeep },
  "Not in": { bg: "#fdecec", ink: colors.danger },
  Done: { bg: "#e5f3ea", ink: colors.success },
};

function VisitCard({ v, onPress }: { v: CustomerVisit; onPress: () => void }) {
  const tone = STATUS_TONE[v.status] ?? STATUS_TONE.Booked;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${v.kind}, ${v.when}, ${v.status}. Open the job`}>
      <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: v.status === "Booked" ? colors.success : colors.edge, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="construct" size={19} color={colors.orangeDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
            {[v.kind, v.title].filter(Boolean).join(": ")}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 13 }}>{v.when}</AppText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <AppText weight="bold" style={{ color: tone.ink, fontSize: 11 }}>
              {v.status}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text3} />
        </View>
      </View>
    </PressableScale>
  );
}

function Customer() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const path = `/api/mobile/staff/customers/${id}`;
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [data, setData] = useState<StaffCustomer | null>(() => readCached<StaffCustomer>(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<StaffCustomer>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load them.");
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      if (staff) load();
    }, [staff, load]),
  );

  // "Take payment" from the chat's "+": the sheet, once they've loaded.
  useEffect(() => {
    if (pay && data) setSheet(true);
    // Once, when they first load.
  }, [pay, !!data]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  async function saveNote() {
    if (!note?.trim() || saving) return;
    setSaving(true);
    try {
      await apiPost(`${path}/notes`, { body: note });
      haptic.success();
      setNote(null);
      load();
    } catch (err) {
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const place = data ? [data.address, data.postcode].filter(Boolean).join(", ") : "";
  const owed = data?.payments.open.filter((p) => !p.monthly) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={data?.name ?? "Customer"} right={data ? <PressableScale onPress={() => openSignedIn(data.links.page)} accessibilityLabel="Open on the website" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="open-outline" size={21} color={colors.navy} /></PressableScale> : null} />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={170} radius={24} />
          <Skeleton height={90} radius={20} />
          <Skeleton height={140} radius={20} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 22 }}
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
          <FadeIn>
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Avatar name={data.name} size={60} />
                <View style={{ flex: 1 }}>
                  <AppText weight="extrabold" style={{ fontSize: 22 }} numberOfLines={2}>
                    {data.name}
                  </AppText>
                  <AppText style={{ color: colors.text2, fontSize: 14 }}>{data.since}</AppText>
                  {data.plan && (
                    <View style={{ alignSelf: "flex-start", marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: data.plan.includes("failed") ? "#fdecec" : "#e5f3ea", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Ionicons name="shield-checkmark" size={13} color={data.plan.includes("failed") ? colors.danger : colors.success} />
                      <AppText weight="bold" style={{ fontSize: 12, color: data.plan.includes("failed") ? colors.danger : colors.success }}>
                        {data.plan}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {data.phone && <Quick icon="call" label="Call" onPress={() => openExternal(`tel:${data.phone}`)} />}
                {data.conversationId && <Quick icon="chatbubbles" label="Chat" onPress={() => router.push(`/chat/${data.conversationId}`)} />}
                {place ? <Quick icon="navigate" label="Directions" onPress={() => openDirections(place)} /> : null}
                {data.email && <Quick icon="mail" label="Email" onPress={() => openExternal(`mailto:${data.email}`)} />}
              </View>
            </Card>
          </FadeIn>

          {/* What to do for them. */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(
              [
                ["calendar", "Book a visit", data.links.book],
                ["receipt", "Invoice", data.links.invoice],
                ["document-text", "Quote", data.links.quote],
              ] as [IconName, string, string][]
            ).map(([icon, label, link]) => (
              <PressableScale key={label} onPress={() => openSignedIn(link)} accessibilityLabel={label} style={{ flex: 1 }}>
                <View style={{ height: 80, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icon} size={18} color={colors.orangeDeep} />
                  </View>
                  <AppText weight="semibold" style={{ fontSize: 13 }}>
                    {label}
                  </AppText>
                </View>
              </PressableScale>
            ))}
          </View>

          <Section title="Jobs underway">
            {data.ongoing.length ? (
              data.ongoing.map((v, i) => (
                <FadeIn key={v.id} index={i}>
                  <VisitCard v={v} onPress={() => router.push(`/job/${v.id}`)} />
                </FadeIn>
              ))
            ) : (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingHorizontal: 4 }}>Nothing booked or waiting.</AppText>
            )}
          </Section>

          <Section title={owed.length ? "Waiting to be paid" : "Payments"}>
            {owed.length ? (
              <Card style={{ gap: 12 }}>
                {owed.map((p) => (
                  <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold" style={{ fontSize: 15 }} numberOfLines={1}>
                        {p.kind === "callout_fee" ? "Call-out fee" : p.description}
                      </AppText>
                      <AppText style={{ color: colors.text2, fontSize: 13 }}>
                        {p.number}
                        {p.paidSoFar ? ` · ${p.paidSoFar} paid of ${p.total}` : ""}
                      </AppText>
                    </View>
                    <AppText weight="extrabold" style={{ fontSize: 17 }}>
                      {p.amount}
                    </AppText>
                  </View>
                ))}
                <PrimaryButton title="Take payment" icon="card" size="medium" onPress={() => setSheet(true)} />
              </Card>
            ) : (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingHorizontal: 4 }}>
                Nothing owed.{data.payments.paidCount ? ` ${data.payments.paidCount} paid before.` : ""}
              </AppText>
            )}
          </Section>

          {data.quotes.length > 0 && (
            <Section title="Quotes">
              <Card style={{ paddingVertical: 4 }}>
                {data.quotes.map((q, i) => (
                  <Row key={q.id} icon="document-text-outline" label={`${q.number} · ${q.status}`} value={`${q.title}, ${q.total}`} onPress={() => openSignedIn(`/staff/quotes/${q.id}`)} last={i === data.quotes.length - 1} />
                ))}
              </Card>
            </Section>
          )}

          <Section
            title="Notes"
            right={
              note === null ? (
                <PressableScale onPress={() => setNote("")} accessibilityLabel="Add a note" style={{ height: 36, justifyContent: "center", paddingLeft: 12 }}>
                  <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
                    + Add a note
                  </AppText>
                </PressableScale>
              ) : null
            }
          >
            {note !== null && (
              <Card style={{ gap: 10 }}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Only the team see this: the key safe, the dog, what to bring…"
                  placeholderTextColor={colors.text3}
                  multiline
                  autoFocus
                  accessibilityLabel="Note"
                  style={{ minHeight: 80, fontSize: 15, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: "top" }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <PressableScale onPress={() => setNote(null)} accessibilityLabel="Cancel" style={{ flex: 1 }}>
                    <View style={{ height: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center" }}>
                      <AppText weight="bold">Cancel</AppText>
                    </View>
                  </PressableScale>
                  <PressableScale onPress={saveNote} disabled={!note.trim() || saving} accessibilityLabel="Save the note" style={{ flex: 1 }}>
                    <View style={{ height: 44, borderRadius: 999, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                      <AppText weight="bold" style={{ color: "#fff" }}>
                        {saving ? "Saving…" : "Save"}
                      </AppText>
                    </View>
                  </PressableScale>
                </View>
              </Card>
            )}
            {data.accessNotes && (
              <View style={{ flexDirection: "row", gap: 10, backgroundColor: colors.orangeLight, borderRadius: 16, padding: 12 }}>
                <Ionicons name="key" size={18} color={colors.orangeDeep} />
                <AppText style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.navy }}>{data.accessNotes}</AppText>
              </View>
            )}
            {data.notes.length ? (
              <Card style={{ gap: 12 }}>
                {data.notes.map((n) => (
                  <View key={n.id} style={{ gap: 2 }}>
                    <AppText style={{ fontSize: 15, lineHeight: 21 }}>{n.body}</AppText>
                    <AppText style={{ color: colors.text3, fontSize: 12 }}>{[n.author, n.when].filter(Boolean).join(" · ")}</AppText>
                  </View>
                ))}
              </Card>
            ) : note === null && !data.accessNotes ? (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingHorizontal: 4 }}>No notes yet.</AppText>
            ) : null}
          </Section>

          <Section title="Details">
            <Card style={{ paddingVertical: 4 }}>
              {data.phone && <Row icon="call-outline" label="Phone" value={data.phone} onPress={() => openExternal(`tel:${data.phone}`)} />}
              {data.email && <Row icon="mail-outline" label="Email" value={data.email} onPress={() => openExternal(`mailto:${data.email}`)} />}
              <Row icon="home-outline" label="Address" value={place || "Not given yet"} onPress={place ? () => openDirections(place) : undefined} last />
            </Card>
          </Section>

          {data.boiler.length > 0 && (
            <Section title="Their boiler">
              <Card style={{ paddingVertical: 4 }}>
                {data.boiler.map((b, i) => (
                  <Row key={b.label} icon="flame-outline" label={b.label} value={b.value} last={i === data.boiler.length - 1} />
                ))}
              </Card>
            </Section>
          )}

          {data.previous.length > 0 && (
            <Section title="Done before">
              <View style={{ gap: 8 }}>
                {data.previous.map((v) => (
                  <PressableScale key={v.id} onPress={() => router.push(`/job/${v.id}`)} accessibilityLabel={`${v.kind}, ${v.when}`}>
                    <Card style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <AppText weight="bold" style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
                          {[v.kind, v.title].filter(Boolean).join(": ")}
                        </AppText>
                        <AppText style={{ color: colors.text3, fontSize: 12 }}>{v.when.split(",")[0]}</AppText>
                      </View>
                      <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }} numberOfLines={4}>
                        {v.report ?? "No notes on what was done."}
                      </AppText>
                    </Card>
                  </PressableScale>
                ))}
              </View>
            </Section>
          )}
        </ScrollView>
      )}
      {data && (
        <PaymentSheet
          visible={sheet}
          context={{ jobId: null, customerName: data.name, on: data.payments.on, terminalLocation: data.payments.terminalLocation, savedCard: data.payments.savedCard, choices: data.payments.open }}
          onClose={() => setSheet(false)}
          onDone={load}
        />
      )}
    </View>
  );
}
