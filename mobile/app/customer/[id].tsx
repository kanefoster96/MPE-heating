import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Image, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { PaymentSheet } from "@/components/payment-sheet";
import { FileAdder } from "@/components/file-adder";
import { TapToPayProvider } from "@/components/tap-to-pay";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { openDirections, openExternal, openInApp } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";
import type { CustomerVisit, StaffCustomer } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Files = {
  today: string;
  certTypes: { key: string; label: string }[];
  certificates: { id: string; label: string; url: string | null; shared: boolean; expired: boolean; detail: string }[];
  photos: { id: string; label: string; url: string | null; shared: boolean }[];
};

/**
 * A customer, for the team: everything about them in one place, from
 * their name at the top of a chat (Kanvas Academy's contact card). Call,
 * message, directions; jobs underway (each opens its job page to move,
 * finish or take payment); what they owe, taken from here; the team's
 * private notes, with a new one; their boiler; and what's been done
 * before; their maintenance plan (send it, cancel or keep it); and their
 * photos and certificates (add, show them or not, delete). Book a visit,
 * invoice or quote, all in the app.
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

function PlanButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ alignSelf: "flex-start" }}>
      <View style={{ height: 46, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
        <AppText weight="bold" style={{ fontSize: 15 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

function FileButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
      <AppText weight="semibold" style={{ fontSize: 13, color: danger ? colors.danger : colors.text2 }}>
        {label}
      </AppText>
    </PressableScale>
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
  const [files, setFiles] = useState<Files | null>(null);
  const [adding, setAdding] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await apiFetch<Files>(`${path}/files`));
    } catch {
      // The rest of the page still works; the section says it couldn't load.
    }
  }, [path]);

  const load = useCallback(async () => {
    setError(null);
    loadFiles();
    try {
      setData(await apiFetch<StaffCustomer>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load them.");
    }
  }, [path, loadFiles]);

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

  // Their chat: the one they have, else one started by their mobile (to text them first).
  async function openChat() {
    if (!data) return;
    if (data.conversationId) return router.push(`/chat/${data.conversationId}`);
    try {
      const res = await apiPost<{ id: string }>("/api/mobile/chat/open", { customerId: data.id });
      router.push(`/chat/${res.id}`);
    } catch (err) {
      notify("Couldn't open a chat", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function removeNote(noteId: string) {
    if (!(await confirmAction("Delete this note?", "It's gone for the whole team.", "Delete"))) return;
    try {
      await apiPost(`${path}/notes`, { noteId }, "DELETE");
      haptic.success();
      load();
    } catch (err) {
      notify("Not deleted", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function plan(intent: string) {
    try {
      const res = await apiPost<{ message: string }>(`${path}/plan`, { intent });
      haptic.success();
      notify("Done", res.message);
      load();
    } catch (err) {
      haptic.warning();
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function file(fileId: string, action: "share" | "unshare" | "remove") {
    if (action === "remove" && !(await confirmAction("Delete this file?", "It's gone for good, from their account too.", "Delete"))) return;
    try {
      await apiPost("/api/mobile/staff/files", { customerId: id, fileId, action }, "PATCH");
      haptic.success();
      loadFiles();
    } catch (err) {
      notify("Not done", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const place = data ? [data.address, data.postcode].filter(Boolean).join(", ") : "";
  const owed = data?.payments.open.filter((p) => !p.monthly) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={data?.name ?? "Customer"} right={data ? <PressableScale onPress={() => router.push(`/customer-form?id=${data.id}`)} accessibilityLabel="Change their details" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="create-outline" size={22} color={colors.navy} /></PressableScale> : null} />
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
                <Quick icon="chatbubbles" label="Chat" onPress={openChat} />
                {place ? <Quick icon="navigate" label="Directions" onPress={() => openDirections(place)} /> : null}
                {data.email && <Quick icon="mail" label="Email" onPress={() => openExternal(`mailto:${data.email}`)} />}
              </View>
            </Card>
          </FadeIn>

          {/* What to do for them. */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(
              [
                ["calendar", "Book a visit", `/visit-form?customer=${data.id}`],
                ["receipt", "Invoice", `/new-payment?customer=${data.id}`],
                ["document-text", "Quote", `/new-quote?customer=${data.id}`],
              ] as [IconName, string, string][]
            ).map(([icon, label, link]) => (
              <PressableScale key={label} onPress={() => router.push(link as never)} accessibilityLabel={label} style={{ flex: 1 }}>
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
                  <Row key={q.id} icon="document-text-outline" label={`${q.number} · ${q.status}`} value={`${q.title}, ${q.total}`} onPress={() => router.push(`/quote/${q.id}`)} last={i === data.quotes.length - 1} />
                ))}
              </Card>
            </Section>
          )}

          <Section title="Maintenance plan">
            <Card style={{ gap: 8 }}>
              <AppText weight={data.planCard.on ? "semibold" : "regular"} style={{ fontSize: 15, lineHeight: 21, color: data.planCard.failed ? colors.danger : colors.navy }}>
                {data.planCard.line}
              </AppText>
              {data.planCard.detail && <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{data.planCard.detail}</AppText>}
              {data.planCard.send && <PrimaryButton title={data.planCard.send} icon="paper-plane" size="medium" onPress={() => plan("send")} />}
              {data.planCard.on && (
                <View style={{ gap: 4 }}>
                  {data.planCard.leaving ? (
                    <PlanButton label="Keep it going" onPress={() => plan("keep")} />
                  ) : (
                    <PlanButton
                      label={data.planCard.cancelLabel ?? "Cancel"}
                      onPress={async () => {
                        if (await confirmAction("Cancel their plan?", "It carries on until the end of what they've paid for (or their minimum term), then stops.", "Cancel it")) plan("cancel");
                      }}
                    />
                  )}
                  <PressableScale
                    onPress={async () => {
                      if (await confirmAction("End the plan today?", "It stops today. What they've paid isn't refunded automatically: refund in Stripe if it should be.", "End it now")) plan("end_now");
                    }}
                    accessibilityLabel="End it today instead"
                    style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
                  >
                    <AppText weight="semibold" style={{ color: colors.danger, fontSize: 14 }}>
                      End it today instead
                    </AppText>
                  </PressableScale>
                </View>
              )}
            </Card>
          </Section>

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
                  <View key={n.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText style={{ fontSize: 15, lineHeight: 21 }}>{n.body}</AppText>
                      <AppText style={{ color: colors.text2, fontSize: 12 }}>{[n.author, n.when].filter(Boolean).join(" · ")}</AppText>
                    </View>
                    <Pressable onPress={() => removeNote(n.id)} accessibilityLabel="Delete this note" style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: -10, marginRight: -10 }, pressed && { opacity: 0.7 }]}>
                      <Ionicons name="trash-outline" size={18} color={colors.text2} />
                    </Pressable>
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

          <Section
            title="Photos and certificates"
            right={
              <PressableScale onPress={() => setAdding((v) => !v)} accessibilityLabel={adding ? "Close" : "Add a photo or certificate"} style={{ height: 36, justifyContent: "center", paddingLeft: 12 }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
                  {adding ? "Close" : "+ Add"}
                </AppText>
              </PressableScale>
            }
          >
            {adding && files && (
              <FileAdder
                customerId={data.id}
                today={files.today}
                certTypes={files.certTypes}
                onAdded={() => {
                  setAdding(false);
                  loadFiles();
                }}
              />
            )}
            {!files ? (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingHorizontal: 4 }}>Loading…</AppText>
            ) : !files.certificates.length && !files.photos.length ? (
              <AppText style={{ color: colors.text2, fontSize: 14, paddingHorizontal: 4 }}>None yet. Gas safety records, service records, Benchmark, photos of the job. Ones you show them are in their account.</AppText>
            ) : (
              <>
                {files.certificates.length > 0 && (
                  <Card style={{ paddingVertical: 4 }}>
                    {files.certificates.map((f, i) => (
                      <View key={f.id} style={{ paddingVertical: 10, gap: 4, borderBottomWidth: i === files.certificates.length - 1 ? 0 : 1, borderBottomColor: colors.edge }}>
                        <PressableScale onPress={() => (f.url ? openInApp(f.url) : undefined)} accessibilityLabel={`${f.label}. Open it`} style={{ minHeight: 44, justifyContent: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Ionicons name="document-text-outline" size={20} color={colors.navy} />
                            <View style={{ flex: 1 }}>
                              <AppText weight="semibold" style={{ fontSize: 15 }}>
                                {f.label}
                              </AppText>
                              {f.detail ? (
                                <AppText weight={f.expired ? "bold" : "regular"} style={{ fontSize: 12, color: f.expired ? colors.danger : colors.text2 }}>
                                  {f.detail}
                                </AppText>
                              ) : null}
                            </View>
                          </View>
                        </PressableScale>
                        <View style={{ flexDirection: "row", gap: 4, marginLeft: 26 }}>
                          <FileButton label={f.shared ? "Hide from them" : "Show them"} onPress={() => file(f.id, f.shared ? "unshare" : "share")} />
                          <FileButton label="Delete" danger onPress={() => file(f.id, "remove")} />
                        </View>
                      </View>
                    ))}
                  </Card>
                )}
                {files.photos.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {files.photos.map((f) => (
                      <View key={f.id} style={{ width: "31%" }}>
                        <PressableScale onPress={() => (f.url ? openInApp(f.url) : undefined)} accessibilityLabel={`${f.label}. Open it`}>
                          <View style={{ aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: colors.grey }}>
                            {f.url ? <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors /> : null}
                          </View>
                        </PressableScale>
                        <AppText style={{ fontSize: 11, color: colors.text2, marginTop: 2 }} numberOfLines={1}>
                          {f.label}
                        </AppText>
                        <PressableScale onPress={() => file(f.id, "remove")} accessibilityLabel={`Delete ${f.label}`} style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, alignItems: "flex-end" }}>
                          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="trash-outline" size={15} color={colors.danger} />
                          </View>
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </Section>

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
