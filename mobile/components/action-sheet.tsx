import type { ComponentProps } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, FadeIn, PressableScale } from "@/components/ui";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
export type SheetAction = { key: string; label: string; icon: IconName; tone?: "orange" | "plain"; onPress: () => void };

/**
 * A sheet of big buttons that slides up from the bottom: the chat's "+"
 * (book a visit, invoice, payment, quote, a photo, their details). Three
 * across, each fading in a moment after the last.
 */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: { visible: boolean; title: string; subtitle?: string; actions: SheetAction[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rows: SheetAction[][] = [];
  for (let i = 0; i < actions.length; i += 3) rows.push(actions.slice(i, i + 3));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: "rgba(31,42,58,0.45)" }} />
      <View style={{ backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.skeleton }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 20 }}>
              {title}
            </AppText>
            {subtitle ? <AppText style={{ color: colors.text2, fontSize: 14 }}>{subtitle}</AppText> : null}
          </View>
          <PressableScale onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={26} color={colors.navy} />
          </PressableScale>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: "row", gap: 10 }}>
              {row.map((a, i) => (
                <FadeIn key={a.key} index={r * 3 + i} style={{ flex: 1 }}>
                  <PressableScale
                    onPress={() => {
                      onClose();
                      // After the sheet's started closing, so what opens next isn't hidden behind it.
                      setTimeout(a.onPress, 250);
                    }}
                    accessibilityLabel={a.label}
                  >
                    <View style={{ height: 96, borderRadius: 20, backgroundColor: a.tone === "orange" ? colors.orangeDeep : colors.card, borderWidth: a.tone === "orange" ? 0 : 1, borderColor: colors.edge, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 6 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: a.tone === "orange" ? "rgba(255,255,255,0.18)" : colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={a.icon} size={21} color={a.tone === "orange" ? "#fff" : colors.orangeDeep} />
                      </View>
                      <AppText weight="semibold" style={{ fontSize: 13, textAlign: "center", color: a.tone === "orange" ? "#fff" : colors.navy }} numberOfLines={2}>
                        {a.label}
                      </AppText>
                    </View>
                  </PressableScale>
                </FadeIn>
              ))}
              {row.length < 3 && Array.from({ length: 3 - row.length }, (_, k) => <View key={`gap-${k}`} style={{ flex: 1 }} />)}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}
