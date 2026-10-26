import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, FlatList, PanResponder, Platform, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread } from "@/components/chat-thread";
import { Avatar } from "@/components/avatar";
import { AppText, Card, LoadError, SecondaryButton, haptic } from "@/components/ui";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14:05" today, "Yesterday", "Tue" this week, then "3 Oct" (Kanvas Academy's inbox). */
function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

type Filter = "all" | "unread" | "open" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
];
const SWIPE = 92;

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
      <Pressable
        onPress={() => {
          settle(0);
          onAction();
        }}
        accessibilityLabel={done ? "Reopen" : "Mark done"}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SWIPE, backgroundColor: done ? colors.navy : colors.success, alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        <Ionicons name={done ? "arrow-undo" : "checkmark-done"} size={22} color="#fff" />
        <AppText weight="bold" style={{ color: "#fff", fontSize: 12 }}>
          {done ? "Reopen" : "Done"}
        </AppText>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: colors.page }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * One inbox row, messenger-style (Kanvas Academy's ConversationRow):
 * avatar, bold name, the latest message ("You:" when it was ours), the time
 * on the right and a dot for unread. Someone who last wrote from the app
 * has a phone on their avatar; a done one reads muted with a tick.
 */
function ConversationRow({ c, onPress }: { c: InboxItem; onPress: () => void }) {
  const unread = c.unread && !c.completed;
  const preview = c.preview ? `${c.fromUs ? "You: " : ""}${c.preview}` : "No messages yet";
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${c.name}${unread ? ", unread" : ""}${c.completed ? ", done" : ""}. ${preview}`}
      accessibilityHint="Swipe left to mark it done"
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 }, pressed && { backgroundColor: colors.cream }]}
    >
      <View>
        <Avatar name={c.name} url={c.avatarUrl} size={50} />
        {c.lastFrom === "app" && (
          <View style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.page, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="phone-portrait" size={12} color={colors.text2} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <AppText weight={unread ? "bold" : "semibold"} numberOfLines={1} style={{ fontSize: 16, flex: 1, minWidth: 0, color: c.completed ? colors.text2 : colors.navy }}>
            {c.name}
            {c.guest ? <AppText style={{ color: colors.text2, fontSize: 16 }}> · Visitor</AppText> : null}
          </AppText>
          <AppText style={{ color: unread ? colors.navy : colors.text2, fontSize: 12 }}>{when(c.lastMessageAt)}</AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
          <AppText weight={unread ? "medium" : "regular"} numberOfLines={1} style={{ flex: 1, color: unread ? colors.navy : colors.text2, fontSize: 14 }}>
            {preview}
          </AppText>
          {unread ? (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orangeDeep }} />
          ) : c.completed ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.text2} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The team chat: pinned above everything as a card, so it reads as the team's noticeboard (Kanvas Academy's TeamCard). */
function TeamCard({ c, onPress }: { c: InboxItem; onPress: () => void }) {
  const preview = c.preview ? `${c.fromUs ? "You: " : ""}${c.preview}` : "No messages yet";
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${c.name}, the team chat${c.unread ? ", unread" : ""}. ${preview}`}
      style={({ pressed }) => [
        { marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: c.unread ? colors.orangeDeep : colors.edge, backgroundColor: colors.cream, flexDirection: "row", alignItems: "center", gap: 14 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="people" size={24} color="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <AppText weight="bold" numberOfLines={1} style={{ fontSize: 16, flexShrink: 1 }}>
              {c.name}
            </AppText>
            <Ionicons name="pin" size={13} color={colors.text2} />
          </View>
          <AppText style={{ color: c.unread ? colors.navy : colors.text2, fontSize: 12 }}>{when(c.lastMessageAt)}</AppText>
        </View>
        <AppText style={{ color: colors.text2, fontSize: 12, marginTop: 1 }}>The team chat</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
          <AppText weight={c.unread ? "medium" : "regular"} numberOfLines={2} style={{ flex: 1, color: c.unread ? colors.navy : colors.text2, fontSize: 14 }}>
            {preview}
          </AppText>
          {c.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orangeDeep }} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The team's inbox (Kanvas Academy's coach inbox, laid out the same): the
 * big "Inbox" title and how many are unread, a search bar edge to edge
 * with the filter (All, Unread, Open, Done) at its end, the team chat
 * pinned as a card, then every customer, newest first. Swipe one left to
 * mark it done. New messages arrive live.
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
      setItems((current) => (current ?? []).map((c) => (c.id === item.id ? { ...c, completed: !item.completed, unread: false } : c)));
      refreshMe();
    } catch (err) {
      notify("Couldn't change that", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const all = items ?? [];
  const team = all.find((c) => c.isTeam);
  const unreadCount = all.filter((c) => c.unread && !c.completed).length;
  const q = search.trim().toLowerCase();
  const list = all
    .filter((c) => !c.isTeam)
    .filter((c) => (filter === "unread" ? c.unread && !c.completed : filter === "open" ? !c.completed : filter === "done" ? c.completed : true))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const showTeam = team && (filter === "all" || (filter === "unread" && team.unread)) && (!q || team.name.toLowerCase().includes(q) || team.preview.toLowerCase().includes(q));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ backgroundColor: colors.page }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <AppText weight="extrabold" accessibilityRole="header" style={{ fontSize: 30, letterSpacing: -0.5 }}>
            Inbox
          </AppText>
          {unreadCount > 0 && <AppText style={{ color: colors.text2, fontSize: 14 }}>{unreadCount} unread</AppText>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.edge }}>
          <Ionicons name="search-outline" size={20} color={colors.text2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={colors.text2}
            accessibilityLabel="Search conversations"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={{ flex: 1, height: 48, fontSize: 16, fontFamily: fonts.regular, color: colors.navy }}
          />
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            accessibilityLabel={`Filter conversations: ${FILTERS.find((f) => f.key === filter)!.label}`}
            style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="options-outline" size={22} color={filter === "all" ? colors.navy : colors.orangeDeep} />
          </Pressable>
        </View>
        {filtersOpen && (
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.edge }} accessibilityRole="radiogroup">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  accessibilityLabel={`${f.label}${active ? ", selected" : ""}`}
                  style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: active ? colors.orangeDeep : colors.edge, backgroundColor: active ? colors.orangeDeep : "transparent" }}>
                    <AppText weight="semibold" style={{ color: active ? "#fff" : colors.text2, fontSize: 12 }}>
                      {f.label}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

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
          ListHeaderComponent={
            <>
              {error ? <AppText style={{ color: colors.danger, paddingHorizontal: 16, marginTop: 12 }}>{error}</AppText> : null}
              {showTeam && team ? <TeamCard c={team} onPress={() => router.push(`/chat/${team.id}`)} /> : null}
            </>
          }
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
              {q ? `No conversations match “${search.trim()}”.` : filter === "all" ? "No conversations yet." : "Nothing here."}
            </AppText>
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.edge, marginLeft: 80 }} />}
          renderItem={({ item }) => (
            <SwipeRow done={item.completed} onAction={() => toggle(item)}>
              <ConversationRow c={item} onPress={() => router.push(`/chat/${item.id}`)} />
            </SwipeRow>
          )}
        />
      )}
    </View>
  );
}
