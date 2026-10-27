import type { ComponentProps } from "react";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TopBar } from "@/components/top-bar";
import { CountBadge } from "@/components/count-badge";
import { useAuth } from "@/contexts/auth";
import { colors, fonts, orangeGradient } from "@/lib/theme";
import { openBooking } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused, color, count = 0 }: { name: IconName; focused: boolean; color: ComponentProps<typeof Ionicons>["color"]; count?: number }) {
  return (
    // Wider than the icon so a badge has room without spilling into the next tab.
    <View style={{ alignItems: "center", width: 52 }}>
      <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color} />
      <CountBadge count={count} right={8} />
    </View>
  );
}

/**
 * The raised orange button in the middle of the tab bar (Kanvas Academy's
 * highlighted Class Pass tab, in MPE's orange): a call-out, the thing
 * someone with a broken boiler came for. For the team, their Jobs.
 */
function CentreIcon({ icon }: { icon: IconName }) {
  return (
    <LinearGradient
      colors={orangeGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 54,
        height: 54,
        borderRadius: 27,
        marginTop: -20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: colors.page,
        shadowColor: colors.orangeDeep,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      }}
    >
      <Ionicons name={icon} size={24} color="#fff" />
    </LinearGradient>
  );
}

/**
 * Five tabs under the top bar: Home, Services, the call-out button, Chat
 * and Jobs. For the team: Home, Menu, Jobs in the middle, Chat, and
 * Payment at the end. The avatar (top left) is the account and the bell
 * (top right) is notifications, so neither needs a tab.
 */
export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  const { staff, signedIn, unreadChats, waiting } = useAuth();

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.orangeDeep,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.edge, height: 60 + bottom, paddingBottom: bottom, paddingTop: 6 },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} /> }} />
      <Tabs.Screen
        name="services"
        options={{ title: "Services", href: staff ? null : undefined, tabBarIcon: ({ focused, color }) => <TabIcon name="construct" focused={focused} color={color} /> }}
      />
      {/* The team's Menu, in Services' place: orange count when something needs them. */}
      <Tabs.Screen
        name="menu"
        options={{ title: "Menu", href: staff ? undefined : null, tabBarIcon: ({ focused, color }) => <TabIcon name="grid" focused={focused} color={color} count={waiting} /> }}
      />
      <Tabs.Screen
        name="callout"
        options={{
          title: staff ? "Jobs" : "Call-out",
          tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, color: colors.orangeDeep },
          tabBarIcon: () => <CentreIcon icon={staff ? "clipboard" : "flame"} />,
          tabBarAccessibilityLabel: staff ? "Jobs" : "Request a call-out",
        }}
        listeners={{
          tabPress: (e) => {
            // Straight to it, from wherever they are.
            e.preventDefault();
            if (staff) router.navigate("/jobs");
            else openBooking(`${SITE_URL}/emergency`, signedIn);
          },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: "Chat", tabBarIcon: ({ focused, color }) => <TabIcon name="chatbubble-ellipses" focused={focused} color={color} count={unreadChats} /> }}
      />
      {/* The team reach Jobs from the middle button, so this slot is theirs for Payment. */}
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", href: staff ? null : undefined, tabBarIcon: ({ focused, color }) => <TabIcon name="clipboard" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="payment"
        options={{ title: "Payment", href: staff ? undefined : null, tabBarIcon: ({ focused, color }) => <TabIcon name="card" focused={focused} color={color} />, tabBarAccessibilityLabel: "Take payment" }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/take-payment");
          },
        }}
      />
    </Tabs>
  );
}
