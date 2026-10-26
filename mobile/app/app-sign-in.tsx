import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PrimaryButton, SecondaryButton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { colors } from "@/lib/theme";

/**
 * Where "Confirm my email" lands in the app: straight from the email
 * (`t`, an app link) or back from the website's confirm page (`h`). Signs
 * them in by itself, then goes back to where they were.
 */
export default function AppSignIn() {
  const { t, h } = useLocalSearchParams<{ t?: string; h?: string }>();
  const router = useRouter();
  const { signInWithLink } = useAuth();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        await signInWithLink(typeof t === "string" && t ? { t } : { h: typeof h === "string" ? h : "" });
        haptic.success();
        setState("done");
        setTimeout(() => {
          if (router.canDismiss()) router.dismissAll();
          router.replace("/");
        }, 900);
      } catch (err) {
        haptic.warning();
        setError(err instanceof Error ? err.message : "That link didn't work.");
        setState("error");
      }
    })();
  }, [t, h, signInWithLink, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
      {state === "working" ? (
        <>
          <ActivityIndicator size="large" color={colors.orangeDeep} />
          <AppText weight="semibold" style={{ fontSize: 18 }}>
            Signing you in…
          </AppText>
        </>
      ) : state === "done" ? (
        <>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <AppText weight="bold" style={{ fontSize: 22 }}>
            You&apos;re signed in
          </AppText>
        </>
      ) : (
        <>
          <Ionicons name="alert-circle" size={56} color={colors.danger} />
          <AppText weight="bold" style={{ fontSize: 20, textAlign: "center" }}>
            That link didn&apos;t work
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", lineHeight: 21 }}>{error}</AppText>
          <View style={{ alignSelf: "stretch", gap: 10, marginTop: 8 }}>
            <PrimaryButton title="Send a new link" icon="mail" size="medium" onPress={() => router.replace("/sign-in")} />
            <SecondaryButton title="Home" icon="home" onPress={() => router.replace("/")} />
          </View>
        </>
      )}
    </View>
  );
}
