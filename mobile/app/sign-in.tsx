import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, PrimaryButton, PressableScale, SecondaryButton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { colors, fonts } from "@/lib/theme";

const FIELD = {
  height: 56,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.edge,
  backgroundColor: colors.page,
  paddingHorizontal: 16,
  fontSize: 17,
  fontFamily: fonts.regular,
  color: colors.navy,
} as const;

/**
 * Sign in, or make an account: the same thing. Their email, then a
 * "Confirm my email" button in the email we send. Tapping it on this phone
 * opens the app signed in (app/app-sign-in.tsx), with nothing to type or
 * remember. No password (the website's /account works the same way). A
 * chat they started as a guest comes with them.
 */
export default function SignIn() {
  const router = useRouter();
  const { on, sendLink, signInWithPassword } = useAuth();
  const [step, setStep] = useState<"email" | "sent" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function send() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you'd like to use.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { password: usePassword } = await sendLink(email);
      setStep(usePassword ? "password" : "sent");
      setResendIn(60);
      if (!usePassword) haptic.success();
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "Couldn't send the email.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      haptic.success();
      router.back();
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Sign in" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={step === "sent" ? "mail-unread" : "person"} size={30} color={colors.orangeDeep} />
          </View>
          {!on ? (
            <>
              <AppText weight="extrabold" style={{ fontSize: 28, lineHeight: 32 }}>
                Accounts are coming soon
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>You can book, see prices and read our guides without one.</AppText>
            </>
          ) : step === "email" ? (
            <>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32 }}>
                Sign in or create an account
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>
                Use the email you booked with to see your visits, invoices and certificates. We&apos;ll email you a button to confirm it&apos;s you. No password needed.
              </AppText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={send}
                accessibilityLabel="Email"
                style={FIELD}
              />
              {error && <AppText style={{ color: colors.danger, fontSize: 15 }}>{error}</AppText>}
              <PrimaryButton title={busy ? "Sending…" : "Email me a link"} icon="mail" onPress={send} />
            </>
          ) : step === "sent" ? (
            <>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32 }}>
                Check your email
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>
                We sent a link to <AppText weight="semibold">{email.trim()}</AppText>. Open it on this phone and tap{" "}
                <AppText weight="semibold">Confirm my email</AppText>. You&apos;ll come straight back here, signed in.
              </AppText>
              {Platform.OS === "ios" && <PrimaryButton title="Open Mail" icon="mail-open" onPress={() => Linking.openURL("message://").catch(() => {})} />}
              <AppText style={{ color: colors.text3, fontSize: 14, lineHeight: 20 }}>Not there? Check your junk folder. The link works once, for an hour.</AppText>
              {error && <AppText style={{ color: colors.danger, fontSize: 15 }}>{error}</AppText>}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PressableScale onPress={() => setStep("email")} accessibilityLabel="Use a different email" style={{ height: 44, justifyContent: "center" }}>
                  <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                    Different email
                  </AppText>
                </PressableScale>
                <PressableScale onPress={send} disabled={resendIn > 0 || busy} accessibilityLabel="Send the link again" style={{ height: 44, justifyContent: "center" }}>
                  <AppText weight="semibold" style={{ color: resendIn > 0 ? colors.text3 : colors.orangeDeep, fontSize: 15 }}>
                    {resendIn > 0 ? `Send again in ${resendIn}s` : "Send it again"}
                  </AppText>
                </PressableScale>
              </View>
            </>
          ) : (
            <>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32 }}>
                Enter the password
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>This account signs in with a password.</AppText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={reviewSignIn}
                accessibilityLabel="Password"
                style={FIELD}
              />
              {error && <AppText style={{ color: colors.danger, fontSize: 15 }}>{error}</AppText>}
              <PrimaryButton title={busy ? "Signing in…" : "Sign in"} icon="log-in" onPress={reviewSignIn} />
              <SecondaryButton title="Different email" onPress={() => setStep("email")} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
