import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, FlatList, LayoutAnimation, PanResponder, Platform, RefreshControl, TextInput, UIManager, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread } from "@/components/chat-thread";
import { Avatar } from "@/components/avatar";
import { AppText, Card, FadeIn, LoadError, PressableScale, SecondaryButton, haptic } from "@/components/ui";
import { RowSkeleton } from "@/components/rows";
import { useAuth } from "@/contexts/auth";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { openExternal } from "@/lib/open-link";
import { colors, fonts } from "@/lib/theme";
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

  // A guest session the first time, and again after signing out.
  useEffect(() => {
    if (on && !session) start();
  }, [on, session, start]);

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

/** "14:05" today, "Yesterday", "Tuesday" this week, then "3 Oct". */
function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Filter = "all" | "unread" | "open" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
];
const SWIPE = 92;

if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));

/**
 * A conversation in the inbox (Kanvas Academy's row): swipe it left for
 * Done (or Reopen), springing back if it's let go early. Built on the
 * phone's own gestures, so nothing extra to install.
 */
function SwipeRow({ done, onAction, children }: { done: boolean; onAction: () => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const settle = useCallback(
    (to: number) => {
      open.current = to !== 0;
      Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== "web", bounciness: 0, speed: 20 }).start();
    },
    [x],
  );
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only clearly sideways drags: scrolling the list still works.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => x.setValue(Math.min(0, Math.max(-SWIPE * 1.4, (open.current ? -SWIPE : 0) + g.dx))),
        onPanResponderRelease: (_e, g) => settle((open.current ? -SWIPE : 0) + g.dx < -SWIPE / 2 ? -SWIPE : 0),
        onPanResponderTerminate: () => settle(open.current ? -SWIPE : 0),
      }),
    [x, settle],
  );
  return (
    <View style={{ overflow: "hidden" }}>
      <PressableScale
        onPress={() => {
          settle(0);
          onAction();
        }}
        accessibilityLabel={done ? "Reopen" : "Mark done"}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SWIPE }}
      >
        <View style={{ flex: 1, backgroundColor: done ? colors.navy : colors.success, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Ionicons name={done ? "arrow-undo" : "checkmark-done"} size={22} color="#fff" />
          <AppText weight="bold" style={{ color: "#fff", fontSize: 12 }}>
            {done ? "Reopen" : "Done"}
          </AppText>
        </View>
      </PressableScale>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: colors.page }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * The team's inbox (Kanvas Academy's coach inbox): the team chat pinned,
 * then whoever's waiting on a reply, then the rest of the open ones, then
 * the ones marked done. Search by name or message, and filter (All,
 * Unread, Open, Done). Swipe a conversation left to mark it done. New
 * messages arrive live.
 */
function Inbox() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [items, setItems] = useState<InboxItem[] | null>(() => readCached<{ conversations: InboxItem[] }>("/api/mobile/chat/inbox")?.conversations ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await apiFetch<{ conversations: InboxItem[] }>("/api/mobile/chat/inbox")).conversations);
      refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the inbox.");
    }
  }, [refreshMe]);

  // Live: a new message anywhere refreshes it, with a poll in case one's missed.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15_000);
      let pending: ReturnType<typeof setTimeout> | null = null;
      const sub = supabase
        ?.channel("inbox:chat_messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(load, 400);
        })
        .subscribe();
      return () => {
        clearInterval(timer);
        if (pending) clearTimeout(pending);
        if (sub) supabase?.removeChannel(sub);
      };
    }, [load]),
  );

  async function toggle(item: InboxItem) {
    try {
      await apiPost("/api/mobile/chat/status", { conversationId: item.id, action: item.completed ? "reopen" : "complete" });
      haptic.success();
      ease();
      setItems((current) => (current ?? []).map((c) => (c.id === item.id ? { ...c, completed: !item.completed, unread: false } : c)));
      refreshMe();
    } catch (err) {
      notify("Couldn't change that", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const all = items ?? [];
  const team = all.find((c) => c.isTeam);
  const unreadCount = all.filter((c) => !c.isTeam && c.unread && !c.completed).length;
  const q = search.trim().toLowerCase();
  const rank = (c: InboxItem) => (c.completed ? 2 : c.unread ? 0 : 1);
  const list = all
    .filter((c) => !c.isTeam)
    .filter((c) => (filter === "unread" ? c.unread && !c.completed : filter === "open" ? !c.completed : filter === "done" ? c.completed : true))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || b.lastMessageAt.localeCompare(a.lastMessageAt));
  const showTeam = team && filter !== "done" && (!q || team.name.toLowerCase().includes(q) || team.preview.toLowerCase().includes(q));

  const header = (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 30, letterSpacing: -0.5 }}>
          Inbox
        </AppText>
        {unreadCount > 0 && (
          <AppText weight="bold" style={{ color: colors.orangeDeep, fontSize: 15, marginBottom: 5 }}>
            {unreadCount} unread
          </AppText>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 46, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 14, gap: 8 }}>
          <Ionicons name="search" size={18} color={colors.text3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search names and messages"
            placeholderTextColor={colors.text3}
            accessibilityLabel="Search conversations"
            returnKeyType="search"
            style={{ flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.navy }}
          />
          {search ? (
            <PressableScale onPress={() => setSearch("")} accessibilityLabel="Clear the search" style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </PressableScale>
          ) : null}
        </View>
        <PressableScale
          onPress={() => {
            ease();
            setFiltersOpen((v) => !v);
          }}
          accessibilityLabel={`Filter: ${FILTERS.find((f) => f.key === filter)!.label}`}
          style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: filter !== "all" ? colors.orangeDeep : colors.card, borderWidth: filter !== "all" ? 0 : 1, borderColor: colors.edge }}
        >
          <Ionicons name="options-outline" size={20} color={filter !== "all" ? "#fff" : colors.navy} />
        </PressableScale>
      </View>
      {filtersOpen && (
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
          {FILTERS.map((f) => (
            <PressableScale
              key={f.key}
              onPress={() => {
                ease();
                setFilter(f.key);
              }}
              accessibilityLabel={`${f.label}${filter === f.key ? ", selected" : ""}`}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: filter === f.key ? colors.navy : colors.card, borderWidth: 1, borderColor: filter === f.key ? colors.navy : colors.edge }}
            >
              <AppText weight="semibold" style={{ color: filter === f.key ? "#fff" : colors.navy, fontSize: 14 }}>
                {f.label}
              </AppText>
            </PressableScale>
          ))}
        </View>
      )}
      {showTeam && team && (
        <PressableScale onPress={() => router.push(`/chat/${team.id}`)} accessibilityLabel={`${team.name}${team.unread ? ", unread" : ""}. ${team.preview}`}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: team.unread ? colors.orangeDeep : colors.edge, padding: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="people" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="pin" size={13} color={colors.text3} />
                <AppText weight={team.unread ? "bold" : "semibold"} style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
                  {team.name}
                </AppText>
                <AppText style={{ color: colors.text3, fontSize: 12 }}>{when(team.lastMessageAt)}</AppText>
              </View>
              <AppText style={{ color: colors.text2, fontSize: 14, marginTop: 2 }} numberOfLines={2}>
                {team.fromUs ? `You: ${team.preview}` : team.preview}
              </AppText>
            </View>
          </View>
        </PressableScale>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {error && !items ? (
        <View style={{ padding: 20 }}>
          <LoadError message={error} onRetry={load} />
        </View>
      ) : !items ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 32 }}
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
            <AppText style={{ color: colors.text2, textAlign: "center", marginTop: 32, paddingHorizontal: 24 }}>
              {q ? `No conversations match "${search.trim()}".` : filter === "unread" ? "Nothing waiting on a reply." : filter === "done" ? "Nothing marked done yet." : "No conversations yet."}
            </AppText>
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.edge, marginLeft: 78 }} />}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <SwipeRow done={item.completed} onAction={() => toggle(item)}>
                <PressableScale onPress={() => router.push(`/chat/${item.id}`)} accessibilityLabel={`${item.name}${item.unread ? ", unread" : ""}${item.completed ? ", done" : ""}. ${item.preview}`} accessibilityHint="Swipe left to mark it done">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13, opacity: item.completed ? 0.65 : 1 }}>
                    <Avatar name={item.name} url={item.avatarUrl} size={48} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <AppText weight={item.unread ? "bold" : "semibold"} style={{ fontSize: 16, flex: 1 }} numberOfLines={1}>
                          {item.name}
                          {item.guest ? <AppText style={{ color: colors.text3, fontSize: 14 }}> · Visitor</AppText> : null}
                        </AppText>
                        <AppText weight={item.unread ? "bold" : "regular"} style={{ color: item.unread ? colors.orangeDeep : colors.text3, fontSize: 12 }}>
                          {when(item.lastMessageAt)}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <AppText weight={item.unread ? "semibold" : "regular"} style={{ flex: 1, color: item.unread ? colors.navy : colors.text2, fontSize: 14 }} numberOfLines={1}>
                          {item.fromUs ? `You: ${item.preview}` : item.preview || "Photo"}
                        </AppText>
                        {item.unread && !item.completed ? (
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orangeDeep }} />
                        ) : item.completed ? (
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        ) : null}
                      </View>
                    </View>
                  </View>
                </PressableScale>
              </SwipeRow>
            </FadeIn>
          )}
        />
      )}
    </View>
  );
}
