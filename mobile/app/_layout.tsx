import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, Platform, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { targetFor } from "@/lib/links";
import { openInApp } from "@/lib/open-link";
import type { PushData } from "@/lib/push";
import { colors } from "@/lib/theme";

// A push that arrives while the app is open still shows as a banner.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

/**
 * Tapping a push opens what it's about (Kanvas Academy's PushNavigator): a
 * chat reply opens Chat, a visit opens Jobs, an invoice its page. A push that
 * lands while the app is open refreshes the counts on the bell and Chat.
 */
function PushNavigator() {
  const router = useRouter();
  const { staff, refreshMe } = useAuth();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => refreshMe());
    return () => sub.remove();
  }, [refreshMe]);

  useEffect(() => {
    if (!response) return;
    const data = (response.notification.request.content.data ?? {}) as PushData;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    if (data.kind === "chat" && data.conversationId) {
      router.push(staff ? `/chat/${data.conversationId}` : "/chat");
    } else if (data.kind === "link" && data.href?.startsWith("/visit/") && !staff) {
      // A visit booked, on the way or done: the job, with its steps.
      router.push("/jobs");
    } else if (data.kind === "link" && data.href) {
      const target = targetFor(data.href, { staff });
      if ("route" in target) router.push(target.route as never);
      else openInApp(target.web);
    } else {
      router.push("/notifications");
    }
  }, [response, router, staff]);

  return null;
}

/** The app: the site's font loaded first, then the tabs, with everything else opening over them. */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.orangeDeep} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        {Platform.OS !== "web" && <PushNavigator />}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="guide/[slug]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="account" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="take-payment" />
          <Stack.Screen name="job/[id]" />
          <Stack.Screen name="customer/[id]" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="visit-form" />
          <Stack.Screen name="finish/[id]" />
          <Stack.Screen name="new-payment" />
          <Stack.Screen name="customer-form" />
          <Stack.Screen name="invoices" />
          <Stack.Screen name="invoice/[id]" />
          <Stack.Screen name="quotes" />
          <Stack.Screen name="new-quote" />
          <Stack.Screen name="quote/[id]" />
          <Stack.Screen name="finance" />
          <Stack.Screen name="metrics" />
          <Stack.Screen name="certificates" />
          <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
          <Stack.Screen name="app-sign-in" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="open" options={{ animation: "none" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
