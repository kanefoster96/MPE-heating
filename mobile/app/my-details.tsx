import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { AccountShell } from "@/components/account-bits";
import { AppText, Card, PrimaryButton, haptic } from "@/components/ui";
import { accountAction, useMyAccount } from "@/lib/my-account";
import { notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

type Field = { key: string; label: string; hint?: string; keyboard?: "phone-pad"; caps?: "words" | "characters"; multiline?: boolean };
const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "You",
    fields: [
      { key: "name", label: "Name", caps: "words" },
      { key: "phone", label: "Mobile", keyboard: "phone-pad" },
      { key: "address", label: "Address", caps: "words" },
      { key: "postcode", label: "Postcode", caps: "characters" },
    ],
  },
  {
    title: "Your boiler",
    fields: [
      { key: "boilerMake", label: "Make", hint: "e.g. Worcester Bosch", caps: "words" },
      { key: "boilerModel", label: "Model", caps: "words" },
      { key: "boilerAge", label: "Roughly how old", hint: "e.g. 8 years" },
      { key: "boilerLocation", label: "Where it is", hint: "e.g. kitchen cupboard" },
      { key: "lastService", label: "Last serviced", hint: "e.g. March 2025" },
      { key: "boilerNotes", label: "Anything else about it", multiline: true },
    ],
  },
  { title: "Getting in", fields: [{ key: "accessNotes", label: "Access notes (the key safe, parking, the dog)", multiline: true }] },
];

/** Their details, address and boiler (the website account's form). Their email is their login, so it isn't here. */
export default function MyDetailsScreen() {
  const { data, error, load } = useMyAccount();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.customer && !values) setValues(data.fields);
  }, [data, values]);

  async function save() {
    if (!values || saving) return;
    setSaving(true);
    const res = await accountAction({ action: "details", ...values });
    setSaving(false);
    if (res?.message) {
      haptic.success();
      notify("Saved", res.message);
      load();
    }
  }

  return (
    <AccountShell title="Details and boiler" data={data} error={error} load={load}>
      {() =>
        values && (
          <>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21, marginHorizontal: 4 }}>Keep these up to date and our engineers arrive knowing what to expect.</AppText>
            {GROUPS.map((g) => (
              <Card key={g.title} style={{ gap: 12 }}>
                <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
                  {g.title}
                </AppText>
                {g.fields.map((f) => (
                  <View key={f.key} style={{ gap: 4 }}>
                    <AppText weight="semibold" style={{ fontSize: 14 }}>
                      {f.label}
                    </AppText>
                    <TextInput
                      value={values[f.key] ?? ""}
                      onChangeText={(v) => setValues({ ...values, [f.key]: v })}
                      placeholder={f.hint}
                      placeholderTextColor={colors.text2}
                      keyboardType={f.keyboard ?? "default"}
                      autoCapitalize={f.caps ?? "sentences"}
                      multiline={f.multiline}
                      accessibilityLabel={f.label}
                      style={{ minHeight: f.multiline ? 80 : 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 14, paddingVertical: f.multiline ? 12 : 0, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: f.multiline ? "top" : "center" }}
                    />
                  </View>
                ))}
              </Card>
            ))}
            <PrimaryButton title={saving ? "Saving…" : "Save details"} onPress={save} />
          </>
        )
      }
    </AccountShell>
  );
}
