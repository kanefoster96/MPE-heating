import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { AppText, Card, LoadError, Skeleton } from "@/components/ui";
import { colors } from "@/lib/theme";

/** A section of a customer's account: a small capitalised title over a card. */
export function AccountSection({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ color: colors.text2, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", marginLeft: 4 }}>
        {title}
      </AppText>
      {intro && <AppText style={{ color: colors.text2, fontSize: 14, lineHeight: 20, marginHorizontal: 4 }}>{intro}</AppText>}
      <Card style={{ paddingVertical: 4 }}>{children}</Card>
    </View>
  );
}

/** One line in a section: what it is, a line under it, and an amount or status on the right. */
export function AccountRow({
  title,
  detail,
  extra,
  amount,
  status,
  tone = "plain",
  onPress,
  last,
}: {
  title: string;
  detail?: string | null;
  extra?: string | null;
  amount?: string;
  status?: string;
  tone?: "good" | "open" | "bad" | "plain";
  onPress?: () => void;
  last?: boolean;
}) {
  const ink = tone === "good" ? colors.success : tone === "open" ? colors.orangeDeep : tone === "bad" ? colors.danger : colors.text2;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.edge }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="semibold" style={{ fontSize: 15 }}>
          {title}
        </AppText>
        {detail ? (
          <AppText numberOfLines={2} style={{ color: colors.text2, fontSize: 13, marginTop: 1 }}>
            {detail}
          </AppText>
        ) : null}
        {extra ? <AppText style={{ color: tone === "bad" ? colors.danger : colors.text2, fontSize: 13, marginTop: 1 }}>{extra}</AppText> : null}
      </View>
      {(amount || status) && (
        <View style={{ alignItems: "flex-end" }}>
          {amount && (
            <AppText weight="bold" style={{ fontSize: 15 }}>
              {amount}
            </AppText>
          )}
          {status && (
            <AppText weight="semibold" style={{ fontSize: 12, color: ink }}>
              {status}
            </AppText>
          )}
        </View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.text2} />}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityLabel={[title, detail, amount, status].filter(Boolean).join(", ")} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A plain button for an account action (outline, or filled orange). */
export function AccountButton({ title, onPress, tone = "outline" }: { title: string; onPress: () => void; tone?: "outline" | "orange" | "danger" }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={title} style={({ pressed }) => [{ alignSelf: "flex-start" }, pressed && { opacity: 0.8 }]}>
      <View
        style={{
          minHeight: 46,
          paddingHorizontal: 18,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone === "orange" ? colors.orangeDeep : colors.page,
          borderWidth: tone === "orange" ? 0 : 1,
          borderColor: tone === "danger" ? colors.danger : colors.edge,
        }}
      >
        <AppText weight="bold" style={{ fontSize: 15, color: tone === "orange" ? "#fff" : tone === "danger" ? colors.danger : colors.navy }}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * The frame of each account screen: its title, then loading, a retry, or
 * (signed in with an email we've no booking under) a note to message us.
 */
export function AccountShell<T extends { customer: boolean }>({
  title,
  data,
  error,
  load,
  children,
}: {
  title: string;
  data: T | null;
  error: string | null;
  load: () => void;
  children: (data: Extract<T, { customer: true }>) => ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader title={title} />
      {error && !data ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={90} radius={20} />
        </View>
      ) : !data.customer ? (
        <View style={{ padding: 20 }}>
          <Card style={{ gap: 6 }}>
            <AppText weight="bold" style={{ fontSize: 17 }}>
              Nothing here yet
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>
              Your visits, invoices and details show here once you&apos;ve booked with us using this email. If you have, message us and we&apos;ll link them up.
            </AppText>
          </Card>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} tintColor={colors.orangeDeep} onRefresh={load} />}
        >
          {children(data as Extract<T, { customer: true }>)}
        </ScrollView>
      )}
    </View>
  );
}
