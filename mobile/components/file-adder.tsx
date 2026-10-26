import { useState } from "react";
import { ActivityIndicator, Platform, Switch, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { DateField } from "@/components/month-grid";
import { AppText, Card, PressableScale, haptic } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { uploadJobFile } from "@/lib/upload";
import { colors, fonts } from "@/lib/theme";

type Picked = { uri: string; mimeType: string };

/** A year on from "YYYY-MM-DD", less a day: when a gas safety record runs out. */
function yearOn(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
/**
 * Adding photos or a certificate for a customer (and the job, when it's
 * from one), from the camera, the photo library or a PDF: the website's
 * uploader, in the app. A gas safety record's expiry fills itself in a
 * year on, which is what its renewal reminder runs from.
 */
export function FileAdder({
  customerId,
  appointmentId = null,
  today,
  certTypes,
  onAdded,
}: {
  customerId: string;
  appointmentId?: string | null;
  today: string;
  certTypes: { key: string; label: string }[];
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<"photo" | "certificate">("photo");
  const [certType, setCertType] = useState("gas_safety");
  const [title, setTitle] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [expiresOn, setExpiresOn] = useState(yearOn(today));
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(files: Picked[]) {
    if (!files.length) return;
    try {
      for (const [i, f] of files.entries()) {
        setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
        const stored = await uploadJobFile(customerId, f.uri, f.mimeType);
        await apiPost("/api/mobile/staff/files", {
          customerId,
          appointmentId,
          kind,
          certType: kind === "certificate" ? certType : null,
          title,
          path: stored.path,
          contentType: stored.contentType,
          size: stored.size,
          issuedOn: kind === "certificate" ? issuedOn : null,
          expiresOn: kind === "certificate" ? expiresOn : null,
          shared,
        });
      }
      haptic.success();
      setTitle("");
      onAdded();
    } catch (err) {
      haptic.warning();
      notify("Not added", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function fromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return notify("Camera is off for MPE", "You can turn it on in Settings.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, exif: false });
    if (!result.canceled) upload(result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" })));
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, exif: false, allowsMultipleSelection: kind === "photo", selectionLimit: kind === "photo" ? 10 : 1 });
    if (!result.canceled) upload(result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" })));
  }

  async function fromFiles() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (!result.canceled) upload(result.assets.slice(0, 1).map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "application/pdf" })));
  }

  const Button = ({ icon, label, onPress }: { icon: "camera" | "images" | "document-attach"; label: string; onPress: () => void }) => (
    <PressableScale onPress={onPress} disabled={!!busy} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ height: 72, borderRadius: 16, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name={icon} size={22} color={colors.orangeDeep} />
        <AppText weight="semibold" style={{ fontSize: 12, color: colors.navy, textAlign: "center" }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
        {(["photo", "certificate"] as const).map((k) => (
          <PressableScale key={k} onPress={() => setKind(k)} accessibilityLabel={`${k === "photo" ? "Photos" : "A certificate"}${kind === k ? ", selected" : ""}`} style={{ flex: 1 }}>
            <View style={{ height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: kind === k ? colors.navy : colors.grey }}>
              <AppText weight="bold" style={{ color: kind === k ? "#fff" : colors.navy, fontSize: 14 }}>
                {k === "photo" ? "Photos" : "Certificate"}
              </AppText>
            </View>
          </PressableScale>
        ))}
      </View>

      {kind === "certificate" && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {certTypes.map((t) => (
              <PressableScale
                key={t.key}
                onPress={() => {
                  setCertType(t.key);
                  if (t.key === "gas_safety") setExpiresOn(yearOn(issuedOn));
                }}
                accessibilityLabel={`${t.label}${certType === t.key ? ", selected" : ""}`}
                style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: certType === t.key ? colors.orangeDeep : colors.card, borderWidth: 1, borderColor: certType === t.key ? colors.orangeDeep : colors.edge }}
              >
                <AppText weight="semibold" style={{ fontSize: 13, color: certType === t.key ? "#fff" : colors.navy }}>
                  {t.label}
                </AppText>
              </PressableScale>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <DateField
              label="Issued"
              value={issuedOn}
              today={today}
              onChange={(d) => {
                setIssuedOn(d);
                if (certType === "gas_safety") setExpiresOn(yearOn(d));
              }}
            />
            <DateField label="Runs out" value={expiresOn} today={today} onChange={setExpiresOn} />
          </View>
        </View>
      )}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={kind === "photo" ? "What it shows (optional)" : "Title (optional)"}
        placeholderTextColor={colors.text3}
        accessibilityLabel="Title"
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 14, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AppText style={{ flex: 1, fontSize: 14 }}>Show it to the customer</AppText>
        <Switch value={shared} onValueChange={setShared} trackColor={{ true: colors.orangeDeep, false: colors.edge }} thumbColor="#fff" accessibilityLabel="Show it to the customer" />
      </View>

      {busy ? (
        <View style={{ height: 72, borderRadius: 16, backgroundColor: colors.grey, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator color={colors.orangeDeep} />
          <AppText weight="semibold">{busy}</AppText>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {Platform.OS !== "web" && <Button icon="camera" label="Take a photo" onPress={fromCamera} />}
          <Button icon="images" label={kind === "photo" ? "Choose photos" : "Choose a photo"} onPress={fromLibrary} />
          {kind === "certificate" && <Button icon="document-attach" label="Choose a PDF" onPress={fromFiles} />}
        </View>
      )}
    </Card>
  );
}
