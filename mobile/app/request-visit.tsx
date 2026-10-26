import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AccountShell } from "@/components/account-bits";
import { DateField } from "@/components/month-grid";
import { AppText, Card, PrimaryButton, haptic } from "@/components/ui";
import { accountAction, useMyAccount } from "@/lib/my-account";
import { notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${label}${active ? ", selected" : ""}`} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
      <View style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.orangeDeep : colors.edge, backgroundColor: active ? colors.orangeDeep : colors.page, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
        <AppText weight="semibold" style={{ fontSize: 14, color: active ? "#fff" : colors.navy, textAlign: "center" }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * Asking for a visit (the website account's Request a visit): what they
 * need, a day and a time of day. It goes on the team's calendar as a
 * request, into their chat, and they're told when it's confirmed.
 */
export default function RequestVisitScreen() {
  const router = useRouter();
  const { data, error, load } = useMyAccount();
  const [kind, setKind] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [part, setPart] = useState("any");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <AccountShell title="Request a visit" data={data} error={error} load={load}>
      {(d) => {
        const chosenKind = kind ?? d.request.kinds[0]?.key;
        const chosenDay = day ?? d.today;
        return (
          <>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21, marginHorizontal: 4 }}>Pick a day and time that suits you. We&apos;ll confirm it, or suggest the nearest time we have.</AppText>
            <Card style={{ gap: 12 }}>
              <AppText weight="bold" style={{ fontSize: 15 }}>
                What do you need?
              </AppText>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {d.request.kinds.map((k) => (
                  <Choice key={k.key} label={k.label} active={chosenKind === k.key} onPress={() => setKind(k.key)} />
                ))}
              </View>
              <DateField label="Day" value={chosenDay} today={d.today} past={false} stacked onChange={setDay} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {d.request.parts.map((p) => (
                  <Choice key={p.key} label={p.label} active={part === p.key} onPress={() => setPart(p.key)} />
                ))}
              </View>
              <AppText weight="bold" style={{ fontSize: 15 }}>
                What&apos;s it about? <AppText style={{ color: colors.text2, fontSize: 15 }}>(optional)</AppText>
              </AppText>
              <TextInput value={note} onChangeText={setNote} multiline maxLength={500} accessibilityLabel="What it's about" style={{ minHeight: 80, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, padding: 12, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: "top" }} />
            </Card>
            <PrimaryButton
              title={sending ? "Sending…" : "Send request"}
              onPress={async () => {
                if (sending) return;
                setSending(true);
                const res = await accountAction({ action: "request", kind: chosenKind, day: chosenDay, part, note });
                setSending(false);
                if (res?.message) {
                  haptic.success();
                  notify("Request sent", res.message);
                  router.replace("/jobs");
                }
              }}
            />
          </>
        );
      }}
    </AccountShell>
  );
}
