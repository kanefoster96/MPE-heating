import { useCallback, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, Card, LoadError, PressableScale, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

type Product = { id: string; name: string; description: string; price: string; upsellPrice: string; autoUpsellPrice: string; upsell: boolean; offer: string };
type Settings = {
  plan: { includes: string; monthPrice: string; yearPrice: string; minMonths: string };
  referrals: { referrerReward: string; friendReward: string };
  reviewUrl: string;
  maxUpsells: number;
  products: Product[];
  suggestions: { name: string; description: string; price: string; from: string | null; why: string }[];
};
type Draft = { name: string; description: string; price: string; upsellPrice: string };
const PATH = "/api/mobile/staff/settings";
const EMPTY: Draft = { name: "", description: "", price: "", upsellPrice: "" };

function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
      <AppText style={{ color: colors.text2, fontSize: 12 }}>{label}</AppText>
      <TextInput
        placeholderTextColor={colors.text3}
        accessibilityLabel={label}
        {...props}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }}
      />
    </View>
  );
}

function Save({ title, onPress, tone = "navy" }: { title: string; onPress: () => void; tone?: "navy" | "orange" }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} style={{ alignSelf: "flex-start" }}>
      <View style={{ height: 46, paddingHorizontal: 20, borderRadius: 999, backgroundColor: tone === "orange" ? colors.orangeDeep : colors.navy, alignItems: "center", justifyContent: "center" }}>
        <AppText weight="bold" style={{ color: "#fff", fontSize: 15 }}>
          {title}
        </AppText>
      </View>
    </PressableScale>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 18 }}>
        {title}
      </AppText>
      {intro && <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{intro}</AppText>}
      {children}
    </Card>
  );
}

/**
 * Settings, in the app (admins only, as on the website): the plan's
 * prices, referral rewards, the Google review link, and MPE's products,
 * up to two of them offered at repairs.
 */
export default function SettingsScreen() {
  const { me, session, ready } = useAuth();
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState<Settings["plan"] | null>(null);
  const [referrals, setReferrals] = useState<Settings["referrals"] | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<Settings>(PATH);
      setData(d);
      setPlan(d.plan);
      setReferrals(d.referrals);
      setReview(d.reviewUrl);
      setEdits(Object.fromEntries(d.products.map((p) => [p.id, { name: p.name, description: p.description, price: p.price, upsellPrice: p.upsellPrice }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load settings.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (me?.admin) load();
    }, [me?.admin, load]),
  );

  if (ready && (!session || (me && !me.admin))) return <Redirect href="/" />;

  async function send(path: string, body: Record<string, unknown>, after?: () => void) {
    try {
      const res = await apiPost<{ message: string }>(path, body);
      haptic.success();
      notify("Saved", res.message);
      after?.();
      load();
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const upsells = data?.products.filter((p) => p.upsell).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Settings" />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data || !plan || !referrals || review === null ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={260} radius={20} />
          <Skeleton height={180} radius={20} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
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
          <Section
            title="Maintenance plan"
            intro={`What it includes, as the site says: ${data.plan.includes}. Set a monthly price, a yearly price or both. Leave one blank and it isn't offered. Members keep the price they joined at.`}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field label="Monthly £" value={plan.monthPrice} onChangeText={(v) => setPlan({ ...plan, monthPrice: v })} placeholder="Not offered" keyboardType="decimal-pad" />
              <Field label="Yearly £" value={plan.yearPrice} onChangeText={(v) => setPlan({ ...plan, yearPrice: v })} placeholder="Not offered" keyboardType="decimal-pad" />
            </View>
            <Field label="Minimum term, months (optional)" value={plan.minMonths} onChangeText={(v) => setPlan({ ...plan, minMonths: v })} placeholder="None" keyboardType="number-pad" />
            <AppText style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>
              With a minimum term, someone who cancels early stays on (and paying) until it&apos;s up. Worth setting for monthly members, so the free service isn&apos;t a one-month sign-up.
            </AppText>
            {!data.plan.monthPrice && !data.plan.yearPrice && (
              <AppText style={{ color: colors.text2, fontSize: 13 }}>No price yet: the plan&apos;s booking form still takes enquiries, but no one can join online.</AppText>
            )}
            <Save title="Save plan prices" onPress={() => send(PATH, { section: "plan", monthPrice: plan.monthPrice, yearPrice: plan.yearPrice, minMonths: plan.minMonths })} />
          </Section>

          <Section
            title="Referrals"
            intro="Every customer gets their own link to share. Someone who books through it gets money off their first job; once that job's paid, the customer who recommended them gets money off their next. Leave both blank to switch referrals off."
          >
            <Field label="The customer who recommends gets £ off" value={referrals.referrerReward} onChangeText={(v) => setReferrals({ ...referrals, referrerReward: v })} placeholder="Nothing" keyboardType="decimal-pad" />
            <Field label="Their friend gets £ off their first job" value={referrals.friendReward} onChangeText={(v) => setReferrals({ ...referrals, friendReward: v })} placeholder="Nothing" keyboardType="decimal-pad" />
            <Save title="Save referral rewards" onPress={() => send(PATH, { section: "referrals", ...referrals })} />
          </Section>

          <Section
            title="Google reviews"
            intro="After a job, customers rate it for you, then get a button to post a review on your Google Business Profile. Everyone gets the button, whatever they rated: only asking happy customers isn't allowed by Google. To find the link: open your Google Business Profile, tap Ask for reviews, and copy the link."
          >
            <Field label="Google review link" value={review} onChangeText={setReview} placeholder="https://g.page/r/…/review" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            {!data.reviewUrl && <AppText style={{ color: colors.text2, fontSize: 13 }}>Until it&apos;s set, customers can still rate the job for you; they just aren&apos;t sent to Google.</AppText>}
            <Save title="Save" onPress={() => send(PATH, { section: "review", reviewUrl: review })} />
          </Section>

          <Section
            title="Products and prices"
            intro={`What you sell, at your prices. They're one-tap lines when you take payment. Tick up to ${data.maxUpsells} to offer at repairs: the customer sees them on their invoice as an extra they can tick, at your repair price.`}
          >
            <AppText weight="semibold" style={{ fontSize: 14 }}>
              Offered at repairs: {upsells} of {data.maxUpsells}
            </AppText>
            {data.products.length === 0 && <AppText style={{ color: colors.text2, fontSize: 14 }}>No products yet. Add one below, or start from a suggestion.</AppText>}
            {data.products.map((p) => {
              const e = edits[p.id] ?? { name: p.name, description: p.description, price: p.price, upsellPrice: p.upsellPrice };
              const set = (patch: Partial<Draft>) => setEdits({ ...edits, [p.id]: { ...e, ...patch } });
              const canTick = p.upsell || upsells < data.maxUpsells;
              return (
                <View key={p.id} style={{ gap: 10, borderRadius: 18, borderWidth: 1, borderColor: p.upsell ? colors.orangeDeep : colors.edge, backgroundColor: p.upsell ? colors.orangeLight : colors.card, padding: 12 }}>
                  <Field label="Name" value={e.name} onChangeText={(v) => set({ name: v })} maxLength={80} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Field label="Price £" value={e.price} onChangeText={(v) => set({ price: v })} keyboardType="decimal-pad" />
                    <Field label="At a repair £" value={e.upsellPrice} onChangeText={(v) => set({ upsellPrice: v })} placeholder={p.autoUpsellPrice} keyboardType="decimal-pad" />
                  </View>
                  <Field label="Description (optional)" value={e.description} onChangeText={(v) => set({ description: v })} maxLength={160} />
                  <AppText style={{ color: colors.text2, fontSize: 13 }}>{p.offer}</AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <Save title="Save" onPress={() => send(`${PATH}/products`, { id: p.id, action: "save", ...e })} />
                    <PressableScale
                      onPress={() => (canTick ? send(`${PATH}/products`, { id: p.id, action: p.upsell ? "upsell_off" : "upsell_on" }) : notify("Untick one first", `Up to ${data.maxUpsells} at a repair.`))}
                      accessibilityLabel={p.upsell ? "Offered at repairs. Stop offering it" : "Offer at repairs"}
                    >
                      <View style={{ height: 46, paddingHorizontal: 14, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: p.upsell ? colors.orangeDeep : colors.edge, backgroundColor: p.upsell ? colors.orangeDeep : colors.card, opacity: canTick ? 1 : 0.6 }}>
                        {p.upsell && <Ionicons name="checkmark" size={16} color="#fff" />}
                        <AppText weight="semibold" style={{ fontSize: 14, color: p.upsell ? "#fff" : colors.navy }}>
                          {p.upsell ? "Offered at repairs" : "Offer at repairs"}
                        </AppText>
                      </View>
                    </PressableScale>
                    <PressableScale
                      onPress={async () => {
                        if (await confirmAction(`Remove ${p.name}?`, "It comes off the list. Old invoices keep it.", "Remove")) send(`${PATH}/products`, { id: p.id, action: "remove" });
                      }}
                      accessibilityLabel={`Remove ${p.name}`}
                      style={{ minHeight: 46, justifyContent: "center", paddingHorizontal: 8 }}
                    >
                      <AppText weight="semibold" style={{ color: colors.danger, fontSize: 14 }}>
                        Remove
                      </AppText>
                    </PressableScale>
                  </View>
                </View>
              );
            })}

            <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.edge, paddingTop: 12 }}>
              <AppText weight="bold" style={{ fontSize: 16 }}>
                Add a product
              </AppText>
              <Field label="Name" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} maxLength={80} />
              <Field label="Description (optional)" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} maxLength={160} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Price £" value={draft.price} onChangeText={(v) => setDraft({ ...draft, price: v })} placeholder="0.00" keyboardType="decimal-pad" />
                <Field label="At a repair £" value={draft.upsellPrice} onChangeText={(v) => setDraft({ ...draft, upsellPrice: v })} placeholder="Auto" keyboardType="decimal-pad" />
              </View>
              <AppText style={{ color: colors.text2, fontSize: 12 }}>Leave the repair price blank for about 20% off.</AppText>
              <Save title="Add product" tone="orange" onPress={() => send(`${PATH}/products`, { action: "add", ...draft }, () => setDraft(EMPTY))} />
            </View>

            {data.suggestions.length > 0 && (
              <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.edge, paddingTop: 12 }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  Good to offer at a repair
                </AppText>
                <AppText style={{ color: colors.text2, fontSize: 13 }}>Quick jobs while the boiler&apos;s open, with a good margin. Add the ones you do, at your prices.</AppText>
                {data.suggestions.map((s) => (
                  <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, padding: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText weight="semibold" style={{ fontSize: 14 }}>
                        {s.name}
                        {s.from ? <AppText style={{ color: colors.text2, fontSize: 14 }}> · {s.from}</AppText> : null}
                      </AppText>
                      <AppText style={{ color: colors.text2, fontSize: 12 }}>{s.why}</AppText>
                    </View>
                    <PressableScale onPress={() => setDraft({ name: s.name, description: s.description, price: s.price, upsellPrice: "" })} accessibilityLabel={`Start a product from ${s.name}`}>
                      <View style={{ height: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center" }}>
                        <AppText weight="semibold" style={{ fontSize: 13 }}>
                          Add
                        </AppText>
                      </View>
                    </PressableScale>
                  </View>
                ))}
              </View>
            )}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}
