import type { ComponentProps } from "react";
import { Alert, Linking, ScrollView, Share, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { AppText, Card, PressableScale, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiPost } from "@/lib/api";
import { openExternal, openInApp } from "@/lib/open-link";
import { useMyAccount } from "@/lib/my-account";
import { MPE_PHONE, SITE_URL } from "@/lib/site";
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
 * Their account (the avatar, top left): their visits (the Jobs tab),
 * invoices and quotes, certificates and photos, the maintenance plan,
 * saved cards, their details and boiler, asking for a visit, and their
 * link to recommend us, each a screen of the app (lib/my-account.ts). The
 * team get a link to their Menu. Sign out and Delete account are at the
 * bottom, as Apple asks.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { me, ready, signedIn, staff, signOut } = useAuth();
  const { data } = useMyAccount();
  const refer = data?.customer ? data.refer : null;

  // Once the saved login has been read: opened cold (a link to their account), it isn't yet.
  if (ready && !signedIn) return <Redirect href="/sign-in" />;

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
            <Row icon="grid" label="Menu" hint="Everything to run MPE, in one place" onPress={() => router.push("/menu")} last />
          </Section>
        ) : (
          <>
            <Section title="Your account">
              <Row icon="calendar" label="Visits" hint="Coming up and past" onPress={() => router.push("/jobs")} />
              <Row icon="add-circle" label="Request a visit" hint="A service, call-out or repair" onPress={() => router.push("/request-visit")} />
              <Row icon="receipt" label="Invoices and receipts" hint="And your quotes" onPress={() => router.push("/my-payments")} />
              <Row icon="shield-checkmark" label="Certificates and photos" onPress={() => router.push("/my-files")} />
              <Row icon="refresh-circle" label="Maintenance plan" onPress={() => router.push("/my-plan")} />
              <Row icon="card" label="Saved cards" onPress={() => router.push("/my-cards")} />
              <Row icon="flame" label="Details and boiler" hint="Address, boiler, access notes" onPress={() => router.push("/my-details")} last />
            </Section>
            {refer && (
              <Section title="Recommend us">
                <View style={{ gap: 8, paddingVertical: 10 }}>
                  <AppText style={{ fontSize: 15, lineHeight: 21 }}>{refer.line}</AppText>
                  {refer.referred > 0 && (
                    <AppText style={{ color: colors.text2, fontSize: 13 }}>
                      You&apos;ve recommended {refer.referred} {refer.referred === 1 ? "person" : "people"}. Thank you!
                    </AppText>
                  )}
                  {refer.credit && (
                    <AppText weight="semibold" style={{ color: colors.success, fontSize: 14 }}>
                      {refer.credit}
                    </AppText>
                  )}
                </View>
                <Row icon="share-social" label="Share your link" onPress={() => Share.share({ message: `${refer.share} ${refer.link}` }).catch(() => {})} last />
              </Section>
            )}
          </>
        )}

        <Section title="App">
          <Row icon="notifications" label="Notifications" hint="Turn them on or off in Settings" onPress={() => Linking.openSettings().catch(() => {})} />
          <Row icon="chatbubbles" label="Chat with us" onPress={() => router.push("/chat")} />
          <Row icon="call" label="Call MPE" hint={MPE_PHONE.display} onPress={() => openExternal(MPE_PHONE.href)} last />
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
