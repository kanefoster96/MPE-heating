import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, orangeGradient } from "@/lib/theme";
import { openInApp } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: ComponentProps<typeof Ionicons>["color"] }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color} />;
}

/**
 * The raised orange button in the middle of the tab bar: a call-out, the
 * thing someone with a broken boiler came for (Kanvas Academy's highlighted
 * Class Pass tab, in MPE's orange).
 */
function CallOutIcon() {
  return (
    <LinearGradient
      colors={orangeGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        marginTop: -18,
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
      <Ionicons name="flame" size={24} color="#fff" />
    </LinearGradient>
  );
}

/**
 * Five tabs: Home, Jobs, the call-out button, Chat and Account. Jobs, Chat
 * and Account are built next; until then they say so plainly rather than
 * looking broken.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orangeDeep,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.edge, height: 84, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ focused, color }) => <TabIcon name="construct" focused={focused} color={color} /> }} />
      <Tabs.Screen
        name="callout"
        options={{ title: "Call-out", tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, color: colors.orangeDeep }, tabBarIcon: () => <CallOutIcon /> }}
        listeners={{
          tabPress: (e) => {
            // Straight to the call-out request, from wherever they are.
            e.preventDefault();
            openInApp(`${SITE_URL}/emergency`);
          },
        }}
      />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ focused, color }) => <TabIcon name="chatbubble-ellipses" focused={focused} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ focused, color }) => <TabIcon name="person-circle" focused={focused} color={color} /> }} />
    </Tabs>
  );
}
