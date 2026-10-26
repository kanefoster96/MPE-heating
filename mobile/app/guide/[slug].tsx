import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, FadeIn, LoadError, PressableScale, PrimaryButton, SecondaryButton, Skeleton } from "@/components/ui";
import { apiGet, readCached } from "@/lib/api";
import { openInApp } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { ContentBlock, Guide } from "@/lib/types";

const PAD = 20;

/**
 * One help guide, read in the app: the same headings, paragraphs, lists and
 * gas-safety callout as the website's /help page, then the service that
 * fixes it and a call-out button, in case reading it made things clearer.
 */
export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const path = `/api/mobile/guides/${slug}`;
  const [guide, setGuide] = useState<Guide | null>(() => readCached<Guide>(path) ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGuide(await apiGet<Guide>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: PAD - 6, paddingBottom: 6, flexDirection: "row", alignItems: "center" }}>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityLabel="Back"
          style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 44, paddingHorizontal: 6 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.orangeDeep} />
          <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 16 }}>
            Help
          </AppText>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 40 }}>
        {error && !guide ? (
          <LoadError message={error} onRetry={load} />
        ) : !guide ? (
          <View style={{ gap: 12, paddingTop: 8 }}>
            <Skeleton width={120} height={22} radius={11} />
            <Skeleton width="95%" height={30} radius={10} />
            <Skeleton width="70%" height={30} radius={10} />
            <View style={{ height: 10 }} />
            {[100, 92, 96, 60, 100, 88].map((w, i) => (
              <Skeleton key={i} width={`${w}%`} height={15} radius={7} />
            ))}
          </View>
        ) : (
          <FadeIn>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingTop: 4 }}>
              <View style={{ backgroundColor: colors.orangeLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <AppText weight="semibold" style={{ color: colors.orangeDeep, fontSize: 12 }}>
                  {guide.category}
                </AppText>
              </View>
              <AppText style={{ color: colors.text3, fontSize: 13 }}>{guide.readTime}</AppText>
            </View>
            <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.6, marginTop: 12 }}>
              {guide.title}
            </AppText>
            <AppText style={{ color: colors.text2, fontSize: 17, lineHeight: 25, marginTop: 10 }}>{guide.description}</AppText>

            <View style={{ marginTop: 18 }}>
              {guide.content.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </View>

            <View style={{ marginTop: 28, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, padding: 18, gap: 10 }}>
              <AppText weight="bold" style={{ fontSize: 18 }}>
                Still not right?
              </AppText>
              <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>A Gas Safe engineer can take a look. You hear the price before anything starts.</AppText>
              <PrimaryButton title={guide.relatedService.label} size="medium" onPress={() => openInApp(guide.relatedService.url)} />
              <SecondaryButton title="Read on the website" icon="open-outline" onPress={() => openInApp(guide.webUrl)} />
            </View>
          </FadeIn>
        )}
      </ScrollView>
    </View>
  );
}

/** One block of a guide, in the website's order and style. */
function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 21, lineHeight: 26, marginTop: 22, marginBottom: 6 }}>
          {block.text}
        </AppText>
      );
    case "p":
      return <AppText style={{ fontSize: 16, lineHeight: 25, color: colors.navy, marginTop: 10 }}>{block.text}</AppText>;
    case "list":
      return (
        <View style={{ gap: 10, marginTop: 10 }}>
          {block.items.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange, marginTop: 9 }} />
              <AppText style={{ flex: 1, fontSize: 16, lineHeight: 25 }}>{item}</AppText>
            </View>
          ))}
        </View>
      );
    case "callout":
      return (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 18, backgroundColor: "#fdecec", borderRadius: 18, borderWidth: 1, borderColor: "#f6caca", padding: 16 }}>
          <Ionicons name="warning" size={22} color={colors.danger} />
          <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{block.text}</AppText>
        </View>
      );
  }
}
