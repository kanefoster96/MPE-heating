import { useEffect, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar } from "@/components/avatar";
import { AppText, PrimaryButton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";

type Row = { id: string; label: string; sub: string };

const FIELD = { height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.page, paddingHorizontal: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.navy } as const;

/**
 * Messaging someone first (the website's "Text a customer first", with
 * Kanvas Academy's new-chat button): pick a customer, or type a mobile
 * and a name. It opens their conversation (the one they have, if they
 * have one), where Text sends the first message by SMS.
 */
export default function NewChatScreen() {
  const router = useRouter();
  const { staff, me, session, ready } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!staff) return;
    const t = setTimeout(async () => {
      try {
        setRows((await apiFetch<{ customers: Row[] }>(`/api/mobile/staff/customers?all=1${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`)).customers.slice(0, 30));
      } catch {
        setRows([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, staff]);

  if (ready && (!session || (me && !me.staff))) return <Redirect href="/" />;

  async function open(body: { customerId?: string; phone?: string; name?: string }) {
    if (opening) return;
    setOpening(true);
    try {
      const res = await apiPost<{ id: string }>("/api/mobile/chat/open", body);
      haptic.success();
      router.replace(`/chat/${res.id}`);
    } catch (err) {
      notify("Couldn't open a chat", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setOpening(false);
    }
  }

  const header = (
    <View style={{ gap: 10, paddingBottom: 6 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
        Text a new number
      </AppText>
      <TextInput value={phone} onChangeText={setPhone} placeholder="Mobile, e.g. 07123 456789" placeholderTextColor={colors.text2} keyboardType="phone-pad" accessibilityLabel="Their mobile number" style={FIELD} />
      <TextInput value={name} onChangeText={setName} placeholder="Their name (optional)" placeholderTextColor={colors.text2} autoCapitalize="words" accessibilityLabel="Their name" style={FIELD} />
      <PrimaryButton title={opening ? "Opening…" : "Open the chat"} icon="chatbubbles" size="medium" onPress={() => open({ phone, name })} />
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17, marginTop: 14 }}>
        Or a customer
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.page }}>
        <Ionicons name="search-outline" size={18} color={colors.text2} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name, phone or postcode" placeholderTextColor={colors.text2} autoCorrect={false} accessibilityLabel="Search customers" style={{ flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title="New message" />
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<AppText style={{ color: colors.text2, textAlign: "center", marginTop: 16 }}>{q.trim() ? "No customers match." : "No customers yet."}</AppText>}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.edge, marginLeft: 56 }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => open({ customerId: item.id })} accessibilityLabel={`Message ${item.label}, ${item.sub}`} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }, pressed && { opacity: 0.7 }]}>
            <Avatar name={item.label} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText weight="semibold" numberOfLines={1} style={{ fontSize: 15 }}>
                {item.label}
              </AppText>
              <AppText numberOfLines={1} style={{ color: colors.text2, fontSize: 13 }}>
                {item.sub}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text2} />
          </Pressable>
        )}
      />
    </View>
  );
}
