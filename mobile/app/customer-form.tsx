import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, Card, LoadError, PrimaryButton, Skeleton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";
import type { StaffCustomer } from "@/lib/types";

type Field = { key: string; label: string; keyboard?: "phone-pad" | "email-address"; caps?: "none" | "words" | "characters" | "sentences"; multiline?: boolean };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Contact",
    fields: [
      { key: "name", label: "Name", caps: "words" },
      { key: "phone", label: "Mobile", keyboard: "phone-pad" },
      { key: "email", label: "Email", keyboard: "email-address", caps: "none" },
      { key: "address", label: "Address", caps: "words" },
      { key: "postcode", label: "Postcode", caps: "characters" },
    ],
  },
  {
    title: "Their boiler",
    fields: [
      { key: "boilerMake", label: "Make", caps: "words" },
      { key: "boilerModel", label: "Model", caps: "words" },
      { key: "boilerAge", label: "Roughly how old" },
      { key: "boilerLocation", label: "Where it is" },
      { key: "lastService", label: "Last serviced" },
      { key: "boilerNotes", label: "Boiler notes", multiline: true },
    ],
  },
  { title: "Getting in", fields: [{ key: "accessNotes", label: "Access notes (the key safe, parking, the dog)", multiline: true }] },
];

/**
 * A new customer, or changing one's details and boiler (the website's
 * customer form, in the app). Checked the same way: a real UK mobile, an
 * email, a postcode. A new one goes on to what he was doing (`then`):
 * booking a visit, an invoice or a quote for them, else their page.
 */
export default function CustomerForm() {
  const { id, then, name } = useLocalSearchParams<{ id?: string; then?: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [values, setValues] = useState<Record<string, string> | null>(id ? null : { name: name ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !staff) return;
    apiFetch<StaffCustomer>(`/api/mobile/staff/customers/${id}`)
      .then((c) => setValues(c.fields))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load them."));
  }, [id, staff]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  async function save() {
    if (!values || saving) return;
    setSaving(true);
    try {
      if (id) {
        await apiPost(`/api/mobile/staff/customers/${id}`, values, "PATCH");
        haptic.success();
        router.back();
      } else {
        const res = await apiPost<{ id: string }>("/api/mobile/staff/customers", values);
        haptic.success();
        const next = then === "visit" ? `/visit-form?customer=${res.id}` : then === "payment" ? `/new-payment?customer=${res.id}` : then === "quote" ? `/new-quote?customer=${res.id}` : `/customer/${res.id}`;
        router.replace(next as never);
      }
    } catch (err) {
      haptic.warning();
      notify("Not saved", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={id ? "Their details" : "New customer"} />
      {error && !values ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={() => setError(null)} />
        </View>
      ) : !values ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={300} radius={20} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }} keyboardShouldPersistTaps="handled">
            {GROUPS.map((g) => (
              <View key={g.title} style={{ gap: 8 }}>
                <AppText weight="bold" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                  {g.title}
                </AppText>
                <Card style={{ gap: 10 }}>
                  {g.fields.map((f) => (
                    <View key={f.key} style={{ gap: 4 }}>
                      <AppText weight="semibold" style={{ fontSize: 13, color: colors.text2, marginLeft: 4 }}>
                        {f.label}
                      </AppText>
                      <TextInput
                        value={values[f.key] ?? ""}
                        onChangeText={(v) => setValues((x) => ({ ...(x ?? {}), [f.key]: v }))}
                        keyboardType={f.keyboard}
                        autoCapitalize={f.caps ?? "sentences"}
                        multiline={f.multiline}
                        accessibilityLabel={f.label}
                        style={{ minHeight: f.multiline ? 80 : 50, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 14, paddingVertical: f.multiline ? 12 : 0, fontSize: 16, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: f.multiline ? "top" : "center" }}
                      />
                    </View>
                  ))}
                </Card>
              </View>
            ))}
          </ScrollView>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
            <PrimaryButton title={saving ? "Saving…" : id ? "Save" : "Add customer"} icon="checkmark" onPress={save} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
