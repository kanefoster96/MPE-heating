import { Image, Pressable, View } from "react-native";
import { AccountRow, AccountSection, AccountShell } from "@/components/account-bits";
import { AppText } from "@/components/ui";
import { useMyAccount } from "@/lib/my-account";
import { openInApp } from "@/lib/open-link";
import { colors } from "@/lib/theme";

/** Certificates and photos the team have shared (gas safety, service records, photos of the job). */
export default function MyFilesScreen() {
  const { data, error, load } = useMyAccount();
  return (
    <AccountShell title="Certificates and photos" data={data} error={error} load={load}>
      {(d) => (
        <>
          {d.certificates.length === 0 && d.photos.length === 0 && (
            <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", marginTop: 24 }}>Nothing yet. Gas safety records, service records and photos of your job show here once we&apos;ve added them.</AppText>
          )}
          {d.certificates.length > 0 && (
            <AccountSection title="Certificates">
              {d.certificates.map((f, i) => (
                <AccountRow key={f.id} title={f.label} detail={f.detail} status={f.url ? "Open" : undefined} onPress={f.url ? () => openInApp(f.url!) : undefined} last={i === d.certificates.length - 1} />
              ))}
            </AccountSection>
          )}
          {d.photos.length > 0 && (
            <View style={{ gap: 8 }}>
              <AppText weight="bold" accessibilityRole="header" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
                Photos
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {d.photos.map((f) => (
                  <Pressable key={f.id} onPress={() => (f.url ? openInApp(f.url) : undefined)} accessibilityLabel={`${f.label}. Open it`} style={({ pressed }) => [{ width: "31%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: colors.grey }, pressed && { opacity: 0.85 }]}>
                    {f.url ? <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </AccountShell>
  );
}
