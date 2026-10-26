import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { RowSkeleton } from "@/components/rows";
import { AppText, LoadError, PressableScale } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { openSignedIn } from "@/lib/open-link";
import { colors } from "@/lib/theme";

type Due = { id: string; title: string; expiresOn: string; customerId: string | null; customer: string | null };

function daysLeft(iso: string): number {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86_400_000);
}

/**
 * Certificates running out in the next 60 days, soonest first. Customers
 * are reminded automatically; this is who's coming up, to book in. Tap one
 * for the customer's page.
 */
export default function CertificatesScreen() {
  const [list, setList] = useState<Due[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setList((await apiFetch<{ certificates: Due[] }>("/api/mobile/staff/certificates")).certificates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load these.");
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="Certificates" />
      {error && !list ? (
        <View style={{ padding: 16 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !list ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={<AppText style={{ color: colors.text2, fontSize: 14, marginBottom: 4 }}>Running out in the next 60 days. Customers get a reminder automatically.</AppText>}
          ListEmptyComponent={<AppText style={{ color: colors.text2, textAlign: "center", marginTop: 40 }}>None running out in the next 60 days.</AppText>}
          renderItem={({ item }) => {
            const left = daysLeft(item.expiresOn);
            const soon = left <= 30;
            return (
              <PressableScale onPress={() => item.customerId && openSignedIn(`/staff/customers/${item.customerId}`)} accessibilityLabel={`${item.customer ?? "Customer"}, ${item.title}, runs out in ${left} days`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: soon ? colors.orangeDeep : colors.edge, padding: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: soon ? colors.orangeLight : colors.grey, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="shield-checkmark" size={22} color={soon ? colors.orangeDeep : colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }}>
                      {item.customer ?? "Customer"}
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 13 }}>{item.title}</AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText weight="bold" style={{ color: soon ? colors.orangeDeep : colors.navy, fontSize: 14 }}>
                      {left <= 0 ? "Today" : `${left} day${left === 1 ? "" : "s"}`}
                    </AppText>
                    <AppText style={{ color: colors.text3, fontSize: 12 }}>{item.expiresOn.split("-").reverse().join("/")}</AppText>
                  </View>
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}
