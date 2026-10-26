import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/avatar";
import { CountBadge } from "@/components/count-badge";
import { PressableScale } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { colors } from "@/lib/theme";

/**
 * The bar over every tab (Kanvas Academy's top-bar): their picture on the
 * left (sign in, or their account), the MPE logo in the middle, and the
 * bell on the right, with a count of what's waiting on them (an invoice to
 * pay, a quote to look at; for the team, new requests).
 */
export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me, signedIn, waiting } = useAuth();
  const name = signedIn ? (me?.user.name ?? me?.user.email ?? null) : null;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
        <PressableScale
          onPress={() => router.push(signedIn ? "/account" : "/sign-in")}
          accessibilityLabel={signedIn ? "Your account" : "Sign in or create an account"}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Avatar name={name} url={signedIn ? me?.user.avatarUrl : null} size={36} />
        </PressableScale>
        <Image source={require("@/assets/mpe-logo.png")} style={{ width: 84, height: 36 }} resizeMode="contain" accessibilityLabel="MPE" />
        <PressableScale
          onPress={() => router.push("/notifications")}
          accessibilityLabel={waiting ? `Notifications, ${waiting} waiting` : "Notifications"}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <View>
            <Ionicons name="notifications-outline" size={26} color={colors.navy} />
            <CountBadge count={waiting} />
          </View>
        </PressableScale>
      </View>
    </View>
  );
}
