import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { AppText } from "@/components/ui";
import { apiFetch, apiPost, ApiError } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { openExternal } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";

type CallTarget = {
  /** Who's being called, for the prompts. */
  name: string;
  /** Call the number on this chat (and note it there)… */
  conversationId?: string;
  /** …or this number. */
  to?: string | null;
  /** Their number, for "Use my own phone" (and the only way until the MPE number's set up). */
  directNumber?: string | null;
};

type Setup = { on: boolean; businessNumber: string | null; ringPhone: string | null; ownPhone: boolean };

// Asked once and shared: a day's job cards each have a Call button.
let setupOnce: Promise<Setup | null> | null = null;
function loadSetup(): Promise<Setup | null> {
  setupOnce ??= apiFetch<Setup>("/api/mobile/staff/call").catch(() => {
    setupOnce = null;
    return null;
  });
  return setupOnce;
}

/**
 * The team's Call buttons (Kanvas Academy's business call): "Call as MPE"
 * rings the engineer's phone first, then puts them through, and the
 * customer sees MPE's number, never theirs. "Use my own phone" dials
 * straight from their phone. Until MPE's Twilio number is set up, Call just
 * dials from their phone as before. The phone that rings first is their
 * own mobile once they've saved one, else MPE's main number.
 *
 * Returns `call` for the buttons and `modal` to render once in the screen.
 */
export function useBusinessCall() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [choosing, setChoosing] = useState<CallTarget | null>(null);
  const [askPhone, setAskPhone] = useState<CallTarget | "change" | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSetup().then(setSetup);
  }, []);

  function direct(target: CallTarget) {
    const number = (target.directNumber ?? target.to)?.replace(/\s+/g, "");
    if (number) openExternal(`tel:${number}`);
  }

  async function place(target: CallTarget) {
    try {
      await apiPost("/api/mobile/staff/call", { conversationId: target.conversationId, to: target.to ?? undefined });
      notify("Ringing you now", `Answer ${setup?.ringPhone ? `on ${setup.ringPhone} ` : ""}and you'll be put through to ${target.name}. They'll see ${setup?.businessNumber ?? "MPE's number"}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(null);
        setAskPhone(target);
        return;
      }
      notify("Couldn't start the call", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function call(target: CallTarget) {
    // Not set up yet: their own phone, as before.
    if (!setup?.on) return direct(target);
    setChoosing(target);
  }

  async function savePhone() {
    if (!askPhone || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiPost<{ phone: string }>("/api/mobile/staff/call/phone", { phone: phoneDraft });
      setSetup((s) => (s ? { ...s, ringPhone: res.phone, ownPhone: true } : s));
      setupOnce = null;
      const target = askPhone;
      setAskPhone(null);
      setPhoneDraft("");
      if (target !== "change") await place(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that number.");
    } finally {
      setSaving(false);
    }
  }

  const button = (label: string, onPress: () => void, tone: "orange" | "outline" | "plain") => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <View style={{ minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: tone === "orange" ? colors.orangeDeep : colors.page, borderWidth: tone === "outline" ? 1 : 0, borderColor: colors.edge }}>
        <AppText weight="bold" style={{ fontSize: 15, color: tone === "orange" ? "#fff" : tone === "plain" ? colors.text2 : colors.navy }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );

  // Our own sheet rather than a system alert, laid out as the Academy's.
  const choiceSheet = (
    <Modal visible={!!choosing} transparent animationType="fade" onRequestClose={() => setChoosing(null)}>
      <Pressable onPress={() => setChoosing(null)} style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.page, borderRadius: 20, padding: 20 }}>
          <AppText weight="bold" style={{ fontSize: 18 }}>
            Call {choosing?.name}
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
            They&apos;ll see {setup?.businessNumber ?? "MPE's number"}, not yours. We ring {setup?.ringPhone ?? "you"} first, then put you through.
          </AppText>
          <View style={{ gap: 10, marginTop: 18 }}>
            {button(
              "Call as MPE",
              () => {
                const target = choosing;
                setChoosing(null);
                if (target) void place(target);
              },
              "orange",
            )}
            {!!(choosing?.directNumber ?? choosing?.to) &&
              button(
                "Use my own phone",
                () => {
                  const target = choosing;
                  setChoosing(null);
                  if (target) direct(target);
                },
                "outline",
              )}
            {button(
              setup?.ownPhone ? "Change the phone we ring" : "Ring my own mobile instead",
              () => {
                setChoosing(null);
                setError(null);
                setPhoneDraft("");
                setAskPhone("change");
              },
              "plain",
            )}
            {button("Cancel", () => setChoosing(null), "plain")}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const phoneSheet = (
    <Modal visible={!!askPhone} transparent animationType="fade" onRequestClose={() => setAskPhone(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 }}>
        <View style={{ backgroundColor: colors.page, borderRadius: 20, padding: 20 }}>
          <AppText weight="bold" style={{ fontSize: 17 }}>
            Where should we ring you?
          </AppText>
          <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
            Calls as MPE ring this phone first; answer it and we put you through. The customer only ever sees {setup?.businessNumber ?? "MPE's number"}.
          </AppText>
          <TextInput
            value={phoneDraft}
            onChangeText={setPhoneDraft}
            placeholder="07123 456789"
            placeholderTextColor={colors.text2}
            keyboardType="phone-pad"
            autoFocus
            accessibilityLabel="Your mobile number"
            style={{ marginTop: 14, height: 50, borderWidth: 1, borderColor: colors.edge, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, backgroundColor: colors.cream }}
          />
          {!!error && <AppText style={{ color: colors.danger, fontSize: 13, marginTop: 8 }}>{error}</AppText>}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1 }}>{button("Cancel", () => setAskPhone(null), "outline")}</View>
            <View style={{ flex: 1 }}>
              <Pressable onPress={savePhone} disabled={saving || !phoneDraft.trim()} accessibilityLabel={askPhone === "change" ? "Save" : "Save and call"} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                <View style={{ minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.orangeDeep, opacity: saving || !phoneDraft.trim() ? 0.5 : 1 }}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <AppText weight="bold" style={{ fontSize: 15, color: "#fff" }}>
                      {askPhone === "change" ? "Save" : "Save and call"}
                    </AppText>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return {
    call,
    modal: (
      <>
        {choiceSheet}
        {phoneSheet}
      </>
    ),
  };
}
