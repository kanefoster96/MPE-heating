import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, PrimaryButton, PressableScale, haptic } from "@/components/ui";
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
 * Sign in, or make an account: the same thing. Their email, then the code
 * we email them. No password to forget (the website's /account works the
 * same way, with a link). A chat they started as a guest comes with them.
 */
export default function SignIn() {
  const router = useRouter();
  const { on, sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function askForCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you'd like to use.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep("code");
      setResendIn(30);
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "Couldn't send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(value = code) {
    if (!/^\d{6,8}$/.test(value.trim())) {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, value);
      haptic.success();
      router.back();
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "That code didn't work.");
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
            <Ionicons name={step === "email" ? "person" : "mail-open"} size={30} color={colors.orangeDeep} />
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
                Use the email you booked with to see your visits, invoices and certificates. We&apos;ll email you a code. No password needed.
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
                onSubmitEditing={askForCode}
                accessibilityLabel="Email"
                style={FIELD}
              />
              {error && <AppText style={{ color: colors.danger, fontSize: 15 }}>{error}</AppText>}
              <PrimaryButton title={busy ? "Sending…" : "Email me a code"} icon="mail" onPress={askForCode} />
            </>
          ) : (
            <>
              <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32 }}>
                Check your email
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>
                We sent a code to <AppText weight="semibold">{email.trim()}</AppText>. Enter it here.
              </AppText>
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 8);
                  setCode(digits);
                  if (digits.length === 6) checkCode(digits);
                }}
                placeholder="123456"
                placeholderTextColor={colors.text3}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="Code from the email"
                style={[FIELD, { fontSize: 26, letterSpacing: 8, textAlign: "center", fontFamily: fonts.semibold }]}
              />
              {error && <AppText style={{ color: colors.danger, fontSize: 15 }}>{error}</AppText>}
              <PrimaryButton title={busy ? "Checking…" : "Sign in"} icon="log-in" onPress={() => checkCode()} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PressableScale onPress={() => setStep("email")} accessibilityLabel="Use a different email" style={{ height: 44, justifyContent: "center" }}>
                  <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 15 }}>
                    Different email
                  </AppText>
                </PressableScale>
                <PressableScale onPress={askForCode} disabled={resendIn > 0 || busy} accessibilityLabel="Send a new code" style={{ height: 44, justifyContent: "center" }}>
                  <AppText weight="semibold" style={{ color: resendIn > 0 ? colors.text3 : colors.orangeDeep, fontSize: 15 }}>
                    {resendIn > 0 ? `New code in ${resendIn}s` : "Send a new code"}
                  </AppText>
                </PressableScale>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
