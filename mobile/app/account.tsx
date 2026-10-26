import type { ComponentProps } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { AppText, Card, PressableScale, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiPost } from "@/lib/api";
import { openExternal, openInApp, openSignedIn } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function Row({ icon, label, hint, onPress, tone = "navy", last }: { icon: IconName; label: string; hint?: string; onPress: () => void; tone?: "navy" | "danger"; last?: boolean }) {
  const color = tone === "danger" ? colors.danger : colors.navy;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={hint ? `${label}. ${hint}` : label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tone === "danger" ? "#fdecec" : colors.grey, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={19} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" style={{ fontSize: 16, color }}>
            {label}
          </AppText>
          {hint && <AppText style={{ color: colors.text3, fontSize: 13, marginTop: 1 }}>{hint}</AppText>}
        </View>
        {tone !== "danger" && <Ionicons name="chevron-forward" size={18} color={colors.text3} />}
      </View>
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="bold" style={{ color: colors.text3, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
        {title}
      </AppText>
      <Card style={{ paddingVertical: 4 }}>{children}</Card>
    </View>
  );
}

/**
 * Their account (the avatar, top left). The records themselves (visits,
 * invoices, cards, the boiler) live on the website's account page, which
 * opens here already signed in. The team get their tools instead. Sign out
 * and Delete account are at the bottom, as Apple asks.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { me, signedIn, staff, signOut } = useAuth();

  if (!signedIn) return <Redirect href="/sign-in" />;

  const name = me?.user.name ?? null;
  const email = me?.user.email ?? null;

  function confirmSignOut() {
    Alert.alert("Sign out?", "You can sign back in any time with your email.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.back();
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This deletes your login and your chat with us. We keep the invoices and job records for work we've done, as the business has to for its accounts. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiPost("/api/mobile/account/delete");
              haptic.success();
              await signOut();
              router.back();
              Alert.alert("Account deleted", "Your login and chat have been deleted.");
            } catch (err) {
              haptic.warning();
              Alert.alert("Not deleted", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Account" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Avatar name={name ?? email} url={me?.user.avatarUrl} size={80} />
          <AppText weight="bold" style={{ fontSize: 22, marginTop: 6 }}>
            {name ?? "Your account"}
          </AppText>
          {email && <AppText style={{ color: colors.text2, fontSize: 15 }}>{email}</AppText>}
          {staff && (
            <View style={{ backgroundColor: colors.navy, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 }}>
              <AppText weight="semibold" style={{ color: "#fff", fontSize: 12 }}>
                MPE team{me?.admin ? " · Admin" : ""}
              </AppText>
            </View>
          )}
        </View>

        {staff ? (
          <Section title="Running MPE">
            <Row icon="card" label="Take payment" hint="Tap to Pay on this phone" onPress={() => router.push("/take-payment")} />
            <Row icon="calendar" label="Schedule" hint="Today and the week ahead" onPress={() => openSignedIn("/staff/schedule")} />
            <Row icon="speedometer" label="Dashboard" hint="Money, jobs and reviews" onPress={() => openSignedIn("/staff")} />
            <Row icon="people" label="Customers" onPress={() => openSignedIn("/staff/customers")} />
            <Row icon="document-text" label="Quotes" onPress={() => openSignedIn("/staff/quotes")} />
            <Row icon="receipt" label="Invoices" onPress={() => openSignedIn("/staff/invoices")} last />
          </Section>
        ) : (
          <Section title="Your account">
            <Row icon="calendar" label="Visits" hint="Coming up and past" onPress={() => openSignedIn("/account#visits")} />
            <Row icon="receipt" label="Invoices and receipts" onPress={() => openSignedIn("/account#payments")} />
            <Row icon="shield-checkmark" label="Certificates and photos" onPress={() => openSignedIn("/account#files")} />
            <Row icon="refresh-circle" label="Maintenance plan" onPress={() => openSignedIn("/account#plan")} />
            <Row icon="card" label="Saved cards" onPress={() => openSignedIn("/account#cards")} />
            <Row icon="flame" label="Details and boiler" hint="Address, boiler, access notes" onPress={() => openSignedIn("/account#details")} last />
          </Section>
        )}

        <Section title="App">
          <Row icon="notifications" label="Notifications" hint="Turn them on or off in Settings" onPress={() => Linking.openSettings().catch(() => {})} />
          <Row icon="chatbubbles" label="Chat with us" onPress={() => router.push("/chat")} />
          <Row icon="call" label="Call MPE" hint="07448 628 101" onPress={() => openExternal("tel:07448628101")} last />
        </Section>

        <Section title="About">
          <Row icon="lock-closed" label="Privacy" onPress={() => openInApp(`${SITE_URL}/privacy`)} />
          <Row icon="document" label="Terms" onPress={() => openInApp(`${SITE_URL}/terms`)} last />
        </Section>

        <Card style={{ paddingVertical: 4 }}>
          <Row icon="log-out" label="Sign out" onPress={confirmSignOut} tone="danger" last={staff} />
          {!staff && <Row icon="trash" label="Delete account" onPress={confirmDelete} tone="danger" last />}
        </Card>

        <AppText style={{ color: colors.text3, fontSize: 12, textAlign: "center" }}>MPE app {Constants.expoConfig?.version ?? ""}</AppText>
      </ScrollView>
    </View>
  );
}
