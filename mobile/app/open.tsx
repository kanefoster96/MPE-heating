import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openInApp } from "@/lib/open-link";
import { SITE_URL } from "@/lib/site";
import { colors } from "@/lib/theme";

/**
 * A website page a link or notification pointed at (an invoice, a quote,
 * a visit): opens it in the in-app browser, then leaves them on Home when
 * they close it. Only pages of MPE's own site.
 */
export default function OpenLink() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const router = useRouter();
  useEffect(() => {
    const target = typeof url === "string" && url.startsWith(`${SITE_URL}/`) ? url : null;
    (async () => {
      if (target) await openInApp(target);
      router.replace("/");
    })();
  }, [url, router]);
  return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
}
