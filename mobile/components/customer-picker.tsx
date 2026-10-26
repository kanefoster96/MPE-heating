import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, PressableScale } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

export type CustomerOption = { id: string; label: string; sub: string; address: string; postcode: string };

/**
 * Finding a customer by name, number or postcode, as he types (the newest
 * show before he does). "New customer" is offered when `onNew` is given.
 */
export function CustomerPicker({ onPick, onNew }: { onPick: (c: CustomerOption) => void; onNew?: (typed: string) => void }) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setOptions((await apiFetch<{ customers: CustomerOption[] }>(`/api/mobile/staff/customers?q=${encodeURIComponent(search.trim())}`)).customers);
      } catch {
        setOptions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", height: 48, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 14, gap: 8 }}>
        <Ionicons name="search" size={18} color={colors.text3} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Name, number or postcode" placeholderTextColor={colors.text3} accessibilityLabel="Find a customer" style={{ flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.navy }} />
      </View>
      {options.slice(0, 8).map((o) => (
        <PressableScale key={o.id} onPress={() => onPick(o)} accessibilityLabel={`${o.label}${o.sub ? `, ${o.sub}` : ""}`}>
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
            <AppText weight="semibold" style={{ fontSize: 15 }}>
              {o.label}
            </AppText>
            {o.sub ? <AppText style={{ color: colors.text2, fontSize: 13 }}>{o.sub}</AppText> : null}
          </View>
        </PressableScale>
      ))}
      {onNew && (
        <PressableScale onPress={() => onNew(search.trim())} accessibilityLabel="Add a new customer" style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="person-add" size={18} color={colors.orangeDeep} />
          <AppText weight="bold" style={{ color: colors.orangeDeep }}>
            New customer
          </AppText>
        </PressableScale>
      )}
    </Card>
  );
}
