import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";
import { colors } from "@/lib/theme";

/** The app: the site's font loaded first, then the tabs, with guides opening over them. */
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
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="guide/[slug]" options={{ presentation: "card" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
