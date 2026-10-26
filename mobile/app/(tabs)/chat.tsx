import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread } from "@/components/chat-thread";
import { Avatar } from "@/components/avatar";
import { AppText, Card, LoadError, PressableScale, SecondaryButton } from "@/components/ui";
import { RowSkeleton } from "@/components/rows";
import { useAuth } from "@/contexts/auth";
import { apiFetch } from "@/lib/api";
import { openExternal } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { InboxItem } from "@/lib/types";

const PHONE = "tel:07448628101";
const WHATSAPP = "https://wa.me/447448628101";

/**
 * Chat. A customer talks to the MPE team here (one conversation, like
 * Kanvas Academy's member chat): no sign-in needed, a photo of the boiler
 * or its error code if it helps. The team see their inbox instead.
 */
export default function ChatTab() {
  const { on, staff, ensureSession, session } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      await ensureSession();
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the chat.");
    }
  }, [ensureSession]);

  useEffect(() => {
    if (on) start();
  }, [on, start]);

  if (!on) return <ChatComingSoon />;
  if (error) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: colors.cream }}>
        <LoadError message={error} onRetry={start} />
      </View>
    );
  }
  if (!ready || !session) return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  if (staff) return <Inbox />;
  // Keyed by login: signing in swaps to their own chat.
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ChatThread key={session.user.id} header={<ChatIntro />} />
    </View>
  );
}

/** The top of a customer's chat: who they're talking to, and the one thing chat isn't for. */
function ChatIntro() {
  return (
    <View style={{ gap: 10 }}>
      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 20 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubbles" size={28} color={colors.orangeDeep} />
        </View>
        <AppText weight="bold" style={{ fontSize: 18, marginTop: 4 }}>
          Chat with the MPE team
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21, textAlign: "center" }}>
          Ask anything, or send a photo of your boiler or the error code on its display. Our engineers reply here.
        </AppText>
      </Card>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#fdecec", borderRadius: 16, padding: 12 }}>
        <Ionicons name="warning" size={18} color={colors.danger} />
        <AppText style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.navy }}>
          Smell gas? Don&apos;t message: leave the property and call the National Gas Emergency Service on 0800 111 999.
        </AppText>
      </View>
    </View>
  );
}

/** Until accounts are switched on in this build: the ways to reach MPE that work now. */
function ChatComingSoon() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, padding: 20, justifyContent: "center" }}>
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orangeLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubbles" size={30} color={colors.orangeDeep} />
        </View>
        <AppText weight="bold" style={{ fontSize: 20, marginTop: 4 }}>
          Live chat is coming soon
        </AppText>
        <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", lineHeight: 21 }}>Until then, call or WhatsApp us and we&apos;ll get straight back to you.</AppText>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
          <SecondaryButton title="Call" icon="call" onPress={() => openExternal(PHONE)} />
          <SecondaryButton title="WhatsApp" icon="logo-whatsapp" tone="whatsapp" onPress={() => openExternal(WHATSAPP)} />
        </View>
      </Card>
    </View>
  );
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The team's inbox (Kanvas Academy's coach inbox): every customer, newest first, unread in bold. */
function Inbox() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await apiFetch<{ conversations: InboxItem[] }>("/api/mobile/chat/inbox")).conversations);
      refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the inbox.");
    }
  }, [refreshMe]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const list = (items ?? []).filter((c) => c.isTeam || c.completed === showDone);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 4 }}>
        {[false, true].map((done) => (
          <PressableScale
            key={String(done)}
            onPress={() => setShowDone(done)}
            accessibilityLabel={done ? "Done" : "Open"}
            style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: showDone === done ? colors.navy : colors.card, borderWidth: 1, borderColor: showDone === done ? colors.navy : colors.edge }}
          >
            <AppText weight="semibold" style={{ color: showDone === done ? "#fff" : colors.navy, fontSize: 14 }}>
              {done ? "Done" : "Open"}
            </AppText>
          </PressableScale>
        ))}
      </View>
      {error && !items ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !items ? (
        <View style={{ padding: 12, gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.orangeDeep}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <AppText style={{ color: colors.text2, textAlign: "center", marginTop: 40 }}>{showDone ? "Nothing marked done yet." : "All caught up."}</AppText>
          }
          renderItem={({ item }) => (
            <PressableScale onPress={() => router.push(`/chat/${item.id}`)} accessibilityLabel={`${item.name}${item.unread ? ", unread" : ""}. ${item.preview}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: item.unread ? colors.orangeDeep : colors.edge, padding: 12 }}>
                {item.isTeam ? (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="people" size={22} color="#fff" />
                  </View>
                ) : (
                  <Avatar name={item.name} url={item.avatarUrl} size={44} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <AppText weight={item.unread ? "bold" : "semibold"} style={{ fontSize: 16, flex: 1 }} numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText style={{ color: colors.text3, fontSize: 12 }}>{ago(item.lastMessageAt)}</AppText>
                  </View>
                  <AppText weight={item.unread ? "semibold" : "regular"} style={{ color: item.unread ? colors.navy : colors.text2, fontSize: 14, marginTop: 2 }} numberOfLines={1}>
                    {item.fromUs ? `You: ${item.preview}` : item.preview || "Photo"}
                  </AppText>
                </View>
                {item.unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orangeDeep }} />}
              </View>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}
