import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { RowSkeleton } from "@/components/rows";
import { AppText, FadeIn, LoadError, PressableScale, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, readCached } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

type Row = { id: string; label: string; sub: string; boiler: string | null };
const PATH = "/api/mobile/staff/customers?all=1";

/** Every customer (the website's Customers, in the app), most recently changed first, with a search. */
export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { staff, me, session, ready } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(() => readCached<{ customers: Row[] }>(PATH)?.customers ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const typed = useRef(q);
  typed.current = q;

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      setRows((await apiFetch<{ customers: Row[] }>(`${PATH}${term.trim() ? `&q=${encodeURIComponent(term.trim())}` : ""}`)).customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load customers.");
    }
  }, []);

  // Back from a customer or a new one: the list again, as searched.
  useFocusEffect(
    useCallback(() => {
      if (staff) load(typed.current);
    }, [staff, load]),
  );

  // Searching as he types, once he pauses.
  useEffect(() => {
    if (!staff) return;
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, staff, load]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader
        title="Customers"
        right={
          <PressableScale onPress={() => router.push("/plan")} accessibilityLabel="Plan members" style={{ height: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.navy} />
            <AppText weight="semibold" style={{ fontSize: 14 }}>
              Plan
            </AppText>
          </PressableScale>
        }
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.card, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={18} color={colors.text2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Name, phone, email, address or postcode"
            placeholderTextColor={colors.text3}
            accessibilityLabel="Search customers"
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }}
          />
          {q ? (
            <PressableScale onPress={() => setQ("")} accessibilityLabel="Clear the search" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 }}>
              <Ionicons name="close-circle" size={18} color={colors.text2} />
            </PressableScale>
          ) : null}
        </View>
      </View>
      {error && !rows ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={() => load(q)} />
        </View>
      ) : !rows ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 8 }}
          ListHeaderComponent={
            q.trim() ? (
              <AppText style={{ color: colors.text2, fontSize: 13, marginLeft: 4, marginBottom: 2 }}>
                {rows.length} result{rows.length === 1 ? "" : "s"} for “{q.trim()}”
              </AppText>
            ) : null
          }
          ListEmptyComponent={
            <AppText style={{ color: colors.text2, textAlign: "center", marginTop: 24, paddingHorizontal: 20 }}>
              {q.trim() ? "No customers match." : "No customers yet. They're added from booking forms, the chat, or here."}
            </AppText>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.orangeDeep}
              onRefresh={async () => {
                setRefreshing(true);
                await load(q);
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item, index }) => (
            <FadeIn index={Math.min(index, 8)}>
              <PressableScale onPress={() => router.push(`/customer/${item.id}`)} accessibilityLabel={`${item.label}, ${item.sub}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, padding: 12 }}>
                  <Avatar name={item.label} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
                      {item.label}
                    </AppText>
                    <AppText style={{ color: colors.text2, fontSize: 13 }} numberOfLines={1}>
                      {item.sub}
                    </AppText>
                    {item.boiler && (
                      <AppText style={{ color: colors.text2, fontSize: 12 }} numberOfLines={1}>
                        {item.boiler}
                      </AppText>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                </View>
              </PressableScale>
            </FadeIn>
          )}
        />
      )}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.page, borderTopWidth: 1, borderTopColor: colors.edge }}>
        <PrimaryButton title="New customer" icon="person-add" onPress={() => router.push("/customer-form")} />
      </View>
    </View>
  );
}
