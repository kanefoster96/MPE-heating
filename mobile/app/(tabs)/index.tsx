import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, FadeIn, LoadError, PressableScale, SecondaryButton } from "@/components/ui";
import { GuideRow, RowSkeleton, SectionTitle, ServiceRow } from "@/components/rows";
import { CountBadge } from "@/components/count-badge";
import { useAuth } from "@/contexts/auth";
import { useHomeData } from "@/lib/use-home";
import { openExternal, openInApp } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors, fonts } from "@/lib/theme";

const PAD = 20;
/** The call-out tile: the deep end of the site's orange, so its small white text stays at 4.5:1 or better. */
const TILE_GRADIENT = [colors.orangeDeep, "#c44a22"] as const;
const PHONE = { display: "07448 628 101", href: "tel:07448628101", whatsapp: "https://wa.me/447448628101" };

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/**
 * Home, top to bottom: book a call-out or a service (the two big buttons),
 * three more services and All services, the help guides with a search,
 * and live chat at the bottom. Prices and guides come from the website
 * (/api/mobile/home), so they're the same in both places; the two big
 * buttons work before it answers.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { me, signedIn, unreadChats } = useAuth();
  const { data, error, load } = useHomeData();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const firstName = signedIn && me?.user.name ? me.user.name.split(" ")[0] : null;
  const callout = data?.services.find((s) => s.id === "repair");
  const servicing = data?.services.find((s) => s.id === "servicing");
  // The two big buttons cover repairs and servicing; the list shows the rest.
  const more = (data?.services ?? []).filter((s) => s.id !== "repair" && s.id !== "servicing").slice(0, 3);

  const guides = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.guides ?? [];
    if (!q) return all;
    return all.filter((g) => `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }}
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
      {/* 1. Book: a call-out or a service. */}
      <View style={{ paddingHorizontal: PAD }}>
        <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 16, marginTop: 4 }}>What can we help with today?</AppText>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <PressableScale onPress={() => openInApp(callout?.bookUrl ?? `${SITE_URL}/emergency`)} accessibilityLabel="Book a call-out. Boiler broken down? £50 call-out, taken off the repair." style={{ flex: 1 }}>
            <LinearGradient colors={TILE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 16, minHeight: 176, justifyContent: "space-between" }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="flame" size={26} color="#fff" />
              </View>
              <View>
                <AppText weight="extrabold" style={{ color: "#fff", fontSize: 20, lineHeight: 23 }}>
                  Book a call{"\u2011"}out
                </AppText>
                <AppText weight="medium" style={{ color: "#fff", fontSize: 14, lineHeight: 19, marginTop: 4 }}>
                  Boiler broken down? £50, taken off the repair.
                </AppText>
              </View>
            </LinearGradient>
          </PressableScale>
          <PressableScale onPress={() => openInApp(servicing?.bookUrl ?? `${SITE_URL}/book/service`)} accessibilityLabel={`Book a service. ${servicing?.price ?? "From £79"}.`} style={{ flex: 1 }}>
            <View style={{ borderRadius: 24, padding: 16, minHeight: 176, justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="build" size={24} color={colors.orangeDeep} />
              </View>
              <View>
                <AppText weight="extrabold" style={{ fontSize: 20, lineHeight: 23 }}>
                  Book a service
                </AppText>
                <AppText weight="medium" style={{ color: colors.text2, fontSize: 14, lineHeight: 19, marginTop: 4 }}>
                  Annual boiler service, {(servicing?.price ?? "From £79").toLowerCase()}.
                </AppText>
              </View>
            </View>
          </PressableScale>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <PressableScale onPress={() => openExternal(PHONE.href)} accessibilityLabel={`Call ${PHONE.display}`} style={{ flex: 1 }}>
            <View style={{ height: 48, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Ionicons name="call" size={18} color={colors.navy} />
              <AppText weight="semibold" style={{ fontSize: 15 }}>
                Call us
              </AppText>
            </View>
          </PressableScale>
          <PressableScale onPress={() => openExternal(PHONE.whatsapp)} accessibilityLabel="WhatsApp us" style={{ flex: 1 }}>
            <View style={{ height: 48, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.whatsapp} />
              <AppText weight="semibold" style={{ fontSize: 15, color: colors.whatsapp }}>
                WhatsApp
              </AppText>
            </View>
          </PressableScale>
        </View>
      </View>

      {/* 2. Three more services, then All services. */}
      <View style={{ paddingHorizontal: PAD, marginTop: 32 }}>
        <SectionTitle title="Services" action="See all" onAction={() => router.push("/services")} />
        {error && !data ? (
          <LoadError message={error} onRetry={load} />
        ) : !data ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {more.map((s, i) => (
              <FadeIn key={s.id} index={i}>
                <ServiceRow service={s} onPress={() => openInApp(s.bookUrl)} />
              </FadeIn>
            ))}
            <SecondaryButton title="All services" icon="grid" onPress={() => router.push("/services")} />
          </View>
        )}
      </View>

      {/* 3. Help and advice, with a search. */}
      <View style={{ paddingHorizontal: PAD, marginTop: 32 }}>
        <SectionTitle title="Help and advice" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 50, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 14, marginBottom: 10 }}>
          <Ionicons name="search" size={20} color={colors.text3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search: pressure, noises, servicing…"
            placeholderTextColor={colors.text3}
            returnKeyType="search"
            accessibilityLabel="Search help guides"
            style={{ flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, height: 48 }}
          />
          {!!search && (
            <PressableScale onPress={() => setSearch("")} accessibilityLabel="Clear search" style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close-circle" size={20} color={colors.text3} />
            </PressableScale>
          )}
        </View>
        {!data ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </View>
        ) : guides.length ? (
          <View style={{ gap: 10 }}>
            {guides.map((g, i) => (
              <FadeIn key={g.slug} index={i}>
                <GuideRow guide={g} onPress={() => router.push(`/guide/${g.slug}`)} />
              </FadeIn>
            ))}
          </View>
        ) : (
          <Card style={{ alignItems: "center", gap: 6 }}>
            <AppText weight="semibold" style={{ fontSize: 16 }}>
              No guide for that yet
            </AppText>
            <AppText style={{ color: colors.text2, textAlign: "center" }}>Ask us in chat and an engineer will help.</AppText>
          </Card>
        )}

        <PressableScale onPress={() => openExternal("tel:0800111999")} accessibilityLabel="Smell gas? Call the National Gas Emergency Service on 0800 111 999" style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#fdecec", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#f6caca" }}>
            <Ionicons name="warning" size={22} color={colors.danger} />
            <AppText style={{ flex: 1, color: colors.navy, fontSize: 14, lineHeight: 19 }}>
              <AppText weight="bold" style={{ color: colors.danger }}>
                Smell gas?{" "}
              </AppText>
              Leave the property and call the National Gas Emergency Service on 0800 111 999.
            </AppText>
          </View>
        </PressableScale>
      </View>

      {/* 4. Live chat. */}
      <View style={{ paddingHorizontal: PAD, marginTop: 32 }}>
        <PressableScale onPress={() => router.push("/chat")} accessibilityLabel={unreadChats ? `Chat with the MPE team, ${unreadChats} unread` : "Chat with the MPE team"}>
          <View style={{ backgroundColor: colors.navy, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chatbubbles" size={28} color="#fff" />
              </View>
              <CountBadge count={unreadChats} top={-2} right={-2} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="bold" style={{ color: "#fff", fontSize: 18 }}>
                Chat with the MPE team
              </AppText>
              <AppText style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 19, marginTop: 2 }}>
                Questions, or a photo of the boiler or its error code. Our engineers reply here.
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </View>
        </PressableScale>
      </View>
    </ScrollView>
  );
}
