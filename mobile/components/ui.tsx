import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, orangeGradient } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Text in the site's font (Outfit), navy by default. */
export function AppText({ style, weight = "regular", ...props }: TextProps & { weight?: keyof typeof fonts }) {
  return <Text {...props} style={[{ fontFamily: fonts[weight], color: colors.navy }, style]} />;
}

function tap() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
}

/**
 * Anything tappable: it eases down a touch while pressed and springs back
 * (Kanvas Academy's press feel), with a light tap on the phone.
 */
export function PressableScale({
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  disabled,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: Platform.OS !== "web", speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** The big orange button, in the site's gradient. */
export function PrimaryButton({ title, icon, onPress, size = "large" }: { title: string; icon?: IconName; onPress: () => void; size?: "large" | "medium" }) {
  const height = size === "large" ? 60 : 48;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} style={styles.buttonShadow}>
      <LinearGradient colors={orangeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, { height }]}>
        {icon && <Ionicons name={icon} size={size === "large" ? 22 : 18} color="#fff" />}
        <AppText weight="bold" style={{ color: "#fff", fontSize: size === "large" ? 18 : 16 }}>
          {title}
        </AppText>
      </LinearGradient>
    </PressableScale>
  );
}

/** A white button with an edge, for the second choice (call, WhatsApp). */
export function SecondaryButton({
  title,
  icon,
  onPress,
  tone = "navy",
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "navy" | "whatsapp";
}) {
  const color = tone === "whatsapp" ? colors.whatsapp : colors.navy;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} style={[styles.button, styles.secondary, { height: 52 }]}>
      {icon && <Ionicons name={icon} size={20} color={color} />}
      <AppText weight="semibold" style={{ color, fontSize: 16 }}>
        {title}
      </AppText>
    </PressableScale>
  );
}

/** A white card with the site's soft edge. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A section's small label and big two-tone heading (the site's lead + orange em). */
export function SectionHeading({ label, lead, em }: { label: string; lead: string; em?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <AppText weight="bold" style={styles.label}>
        {label}
      </AppText>
      <AppText weight="extrabold" style={styles.heading}>
        {lead}
        {em ? <AppText weight="extrabold" style={[styles.heading, { color: colors.orangeDeep }]}>{` ${em}`}</AppText> : null}
      </AppText>
    </View>
  );
}

/**
 * A grey box standing in for something still loading, gently pulsing so
 * it reads as "on its way" rather than empty.
 */
export function Skeleton({ width = "100%", height, radius = 12, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity }, style]} />;
}

/** Fades and lifts its children in once they've arrived, a little after the one before (`index`). */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 380, delay: Math.min(index, 8) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [progress, index]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** When a load failed with nothing to show: what happened, and Try again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.text3} />
      <AppText weight="semibold" style={{ fontSize: 17, textAlign: "center" }}>
        Couldn&apos;t load this
      </AppText>
      <AppText style={{ color: colors.text2, textAlign: "center" }}>{message}</AppText>
      <View style={{ alignSelf: "stretch", marginTop: 6 }}>
        <PrimaryButton title="Try again" size="medium" onPress={onRetry} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 22,
  },
  buttonShadow: {
    borderRadius: 999,
    shadowColor: colors.orangeDeep,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.edge,
    padding: 18,
  },
  label: {
    color: colors.orangeDeep,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heading: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
});
