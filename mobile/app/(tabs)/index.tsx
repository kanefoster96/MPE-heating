import { useCallback, useState, type ComponentProps } from "react";
import { Image, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, FadeIn, LoadError, PressableScale, PrimaryButton, SecondaryButton, SectionHeading, Skeleton } from "@/components/ui";
import { apiGet, readCached } from "@/lib/api";
import { openExternal, openInApp } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors } from "@/lib/theme";
import type { HomeData, ServiceIcon } from "@/lib/types";

type IconName = ComponentProps<typeof Ionicons>["name"];

const HOME_PATH = "/api/mobile/home";
const PAD = 20;

/**
 * Until the site answers (or with no signal at all), the call-out still
 * works: the website's own words and numbers, bundled with the app. The
 * site's copy replaces it as soon as it arrives.
 */
const FALLBACK: Pick<HomeData, "business" | "callout"> = {
  business: {
    name: "MPE",
    fullName: "MPE Gas, Heating, Plumbing & Electrics",
    phoneDisplay: "07448 628 101",
    phoneHref: "tel:07448628101",
    whatsappHref: "https://wa.me/447448628101",
    gasSafeNumber: "552052",
    base: "Whitley Bay",
  },
  callout: {
    title: "Boiler broken down?",
    em: "We'll be round today.",
    text: "A Gas Safe engineer at your door for a £50 call-out. Go ahead with the repair and the £50 comes off your bill. Most faults fixed on the spot with parts from the van.",
    cta: "Request a call-out",
    bookUrl: `${SITE_URL}/emergency`,
    sameDay: "Call our engineers directly, for the best chance of a same-day call-out.",
    steps: [
      { title: "We find the fault", text: "A Gas Safe engineer, usually the same day if you book by midday." },
      { title: "You hear the price first", text: "Nothing starts until you've said yes." },
      { title: "Go ahead: the £50 comes off", text: "Taken off your repair bill, in full." },
      { title: "Don't: £50 is all you pay", text: "No pressure, no extra charges." },
    ],
    foot: "Every repair guaranteed for 3 months.",
    fee: "£50 call-out. Refunded in full when we do the repair.",
  },
};

const SERVICE_ICON: Record<ServiceIcon, IconName> = {
  boiler: "flame",
  service: "build",
  newboiler: "cube",
  plumbing: "water",
  electrics: "flash",
  landlord: "document-text",
};

/**
 * Home: three things, in the order someone needs them. If the boiler's
 * broken, the call-out right at the top: request it, ring, or WhatsApp,
 * with the £50 explained. If it isn't, every service with its price and a
 * Book button. And if they're not sure what's wrong, the help guides.
 * Everything below the call-out comes from the website, so prices and
 * guides stay the same in both places.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<HomeData | null>(() => readCached<HomeData>(HOME_PATH) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiGet<HomeData>(HOME_PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const business = data?.business ?? FALLBACK.business;
  const callout = data?.callout ?? FALLBACK.callout;
  const guideWidth = Math.min(280, width * 0.72);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}
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
      {/* Top: the logo, and a call button that's always one tap away. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD, paddingBottom: 12 }}>
        <Image source={require("@/assets/mpe-logo.png")} style={{ width: 104, height: 45 }} resizeMode="contain" accessibilityLabel={business.fullName} />
        <PressableScale
          onPress={() => openExternal(business.phoneHref)}
          accessibilityLabel={`Call ${business.phoneDisplay}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge }}
        >
          <Ionicons name="call" size={18} color={colors.navy} />
          <AppText weight="semibold" style={{ fontSize: 15 }}>
            Call us
          </AppText>
        </PressableScale>
      </View>

      {/* 1. Broken down: the call-out. */}
      <View style={{ paddingHorizontal: PAD }}>
        <Card style={{ padding: 22, borderColor: colors.orangeLight, borderWidth: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.whatsappTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14 }}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <AppText weight="semibold" style={{ color: colors.success, fontSize: 12 }}>
              Gas Safe registered {business.gasSafeNumber}
            </AppText>
          </View>
          <AppText weight="extrabold" style={{ fontSize: 34, lineHeight: 37, letterSpacing: -0.8 }}>
            {callout.title}
          </AppText>
          <AppText weight="extrabold" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.8, color: colors.orangeDeep }}>
            {callout.em}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23, marginTop: 10 }}>{callout.text}</AppText>

          <View style={{ marginTop: 20, gap: 10 }}>
            <PrimaryButton title={callout.cta} icon="flame" onPress={() => openInApp(callout.bookUrl)} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton title="Call" icon="call" onPress={() => openExternal(business.phoneHref)} />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton title="WhatsApp" icon="logo-whatsapp" tone="whatsapp" onPress={() => openExternal(business.whatsappHref)} />
              </View>
            </View>
            <AppText style={{ color: colors.text3, fontSize: 13, textAlign: "center", marginTop: 2 }}>{callout.sameDay}</AppText>
          </View>

          <View style={{ marginTop: 20, borderRadius: 18, backgroundColor: colors.cream, padding: 16, gap: 14 }}>
            <AppText weight="bold" style={{ fontSize: 16 }}>
              Your £50 call-out
            </AppText>
            {callout.steps.map((step, i) => (
              <View key={step.title} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center" }}>
                  <AppText weight="bold" style={{ color: "#fff", fontSize: 13 }}>
                    {i + 1}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" style={{ fontSize: 15 }}>
                    {step.title}
                  </AppText>
                  <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 1 }}>{step.text}</AppText>
                </View>
              </View>
            ))}
            <AppText weight="medium" style={{ color: colors.text2, fontSize: 13 }}>
              {callout.foot}
            </AppText>
          </View>
        </Card>
      </View>

      {/* 2. Not broken down: every service, its price, and Book. */}
      <View style={{ paddingHorizontal: PAD, marginTop: 36 }}>
        <SectionHeading label="Services and prices" lead="Not broken down?" em="We do the rest too." />
        {error && !data ? (
          <LoadError message={error} onRetry={load} />
        ) : !data ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, padding: 16 }}>
                <Skeleton width={52} height={52} radius={16} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="45%" height={16} radius={8} />
                  <Skeleton width="80%" height={13} radius={7} />
                  <Skeleton width={90} height={22} radius={11} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {data.services.map((s, i) => (
              <FadeIn key={s.id} index={i}>
                <PressableScale onPress={() => openInApp(s.bookUrl)} accessibilityLabel={`${s.title}, ${s.price}. Book`}>
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={SERVICE_ICON[s.icon] ?? "build"} size={26} color={colors.orangeDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText weight="bold" style={{ fontSize: 17 }}>
                        {s.title}
                      </AppText>
                      <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 2 }} numberOfLines={2}>
                        {s.headline}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <View style={{ backgroundColor: colors.cream, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <AppText weight="bold" style={{ fontSize: 13 }}>
                            {s.price}
                          </AppText>
                        </View>
                        <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 14 }}>
                          Book
                        </AppText>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text3} />
                  </Card>
                </PressableScale>
              </FadeIn>
            ))}

            <FadeIn index={data.services.length}>
              <PressableScale onPress={() => openInApp(data.plan.bookUrl)} accessibilityLabel={`${data.plan.title}. ${data.plan.price ?? "Get the details"}`}>
                <View style={{ backgroundColor: colors.navy, borderRadius: 22, padding: 20 }}>
                  <AppText weight="bold" style={{ color: "#ffc53d", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase" }}>
                    {data.plan.title}
                  </AppText>
                  <AppText weight="extrabold" style={{ color: "#fff", fontSize: 24, marginTop: 4 }}>
                    {data.plan.headline}
                  </AppText>
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {data.plan.points.map((p) => (
                      <View key={p} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <Ionicons name="checkmark-circle" size={18} color="#ffc53d" />
                        <AppText style={{ color: "#fff", fontSize: 15 }}>{p}</AppText>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
                      {data.plan.price ?? "Get the plan details"}
                    </AppText>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  </View>
                </View>
              </PressableScale>
            </FadeIn>
          </View>
        )}
      </View>

      {/* 3. Not sure what's wrong: help and guides. */}
      <View style={{ marginTop: 36 }}>
        <View style={{ paddingHorizontal: PAD }}>
          <SectionHeading label="Help and guides" lead="Not sure what's wrong?" em="Start here." />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }} decelerationRate="fast" snapToInterval={guideWidth + 12}>
          {!data
            ? [0, 1].map((i) => (
                <View key={i} style={{ width: guideWidth, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, padding: 18, gap: 10 }}>
                  <Skeleton width={110} height={22} radius={11} />
                  <Skeleton width="90%" height={18} radius={8} />
                  <Skeleton width="70%" height={18} radius={8} />
                  <Skeleton width="100%" height={13} radius={7} style={{ marginTop: 6 }} />
                  <Skeleton width="85%" height={13} radius={7} />
                </View>
              ))
            : data.guides.map((g, i) => (
                <FadeIn key={g.slug} index={i}>
                  <PressableScale onPress={() => router.push(`/guide/${g.slug}`)} accessibilityLabel={g.title} style={{ width: guideWidth }}>
                    <Card style={{ minHeight: 240, justifyContent: "space-between" }}>
                      <View>
                        <View style={{ alignSelf: "flex-start", backgroundColor: colors.orangeLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 12 }}>
                            {g.category}
                          </AppText>
                        </View>
                        <AppText weight="bold" style={{ fontSize: 18, lineHeight: 23, marginTop: 12 }} numberOfLines={3}>
                          {g.title}
                        </AppText>
                        <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 6 }} numberOfLines={2}>
                          {g.description}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                        <AppText style={{ color: colors.text3, fontSize: 13 }}>{g.readTime}</AppText>
                        <Ionicons name="arrow-forward-circle" size={28} color={colors.orangeDeep} />
                      </View>
                    </Card>
                  </PressableScale>
                </FadeIn>
              ))}
        </ScrollView>

        {/* Gas safety: the one thing never to wait on. The National Gas Emergency number, as on every guide. */}
        <View style={{ paddingHorizontal: PAD, marginTop: 16 }}>
          <PressableScale onPress={() => openExternal("tel:0800111999")} accessibilityLabel="Smell gas? Call the National Gas Emergency Service on 0800 111 999">
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: "#fdecec", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "#f6caca" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="warning" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="bold" style={{ fontSize: 16, color: colors.danger }}>
                  Smell gas?
                </AppText>
                <AppText style={{ color: colors.navy, fontSize: 14, lineHeight: 19, marginTop: 2 }}>
                  Leave the property and call the National Gas Emergency Service on 0800 111 999.
                </AppText>
              </View>
            </View>
          </PressableScale>
        </View>
      </View>

      <AppText style={{ color: colors.text3, fontSize: 12, textAlign: "center", marginTop: 32, paddingHorizontal: PAD }}>
        {business.fullName} · Gas Safe registered {business.gasSafeNumber} · {business.base}
      </AppText>
    </ScrollView>
  );
}
