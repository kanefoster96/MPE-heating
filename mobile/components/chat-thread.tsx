import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Image, Keyboard, Platform, Pressable, TextInput, View, type KeyboardEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale, Skeleton, haptic } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { ImageViewer } from "@/components/image-viewer";
import { ActionSheet, type SheetAction } from "@/components/action-sheet";
import { apiFetch, apiPost } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { supabase } from "@/lib/supabase";
import { uploadChatPhoto } from "@/lib/upload";
import { openInApp } from "@/lib/open-link";
import { registerForPush } from "@/lib/push";
import { colors, fonts } from "@/lib/theme";
import type { ChatMessage, ConversationResponse } from "@/lib/types";

const POLL_MS = 6000;
const GAP_FOR_DIVIDER_MS = 5 * 60_000;
type Channel = "chat" | "email" | "sms";

/** Messages by id, oldest first; a sent message replaces the stand-in shown while it was sending. */
function merge(current: ChatMessage[], incoming: ChatMessage[], viewerId: string | null): ChatMessage[] {
  const byId = new Map(current.filter((m) => !m.pending).map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  const real = [...byId.values()];
  // Stand-ins still waiting: drop one per real message from me with the same text.
  const pending = current.filter((m) => m.pending);
  const left = pending.filter((p) => !incoming.some((m) => m.senderId === viewerId && m.body === p.body && (!!m.attachmentPath === !!p.localUri)));
  return [...real, ...left].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 18 · 19:12", over a message after a gap (Kanvas Academy's divider). */
function dayTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const CHANNEL_LABEL: Record<Channel, string> = { chat: "Live chat", sms: "Text", email: "Email" };
const CHANNEL_ICON = { chat: "chatbubble-ellipses", sms: "chatbox-ellipses", email: "mail" } as const;

// One line at rest; grows to about five lines, then scrolls inside.
const COMPOSER_MIN = 44;
const COMPOSER_MAX = 22 * 5 + 20;

/** "[label](url)" and bare links in a message, as tappable text (the site writes links that way). */
function MessageText({ body, color }: { body: string; color: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    const url = match[2] ?? match[3];
    const label = match[1] ?? match[3];
    parts.push(
      <AppText key={match.index} weight="semibold" style={{ color, textDecorationLine: "underline" }} onPress={() => openInApp(url)} accessibilityRole="link">
        {label}
      </AppText>,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <AppText style={{ color, fontSize: 15, lineHeight: 21 }}>{parts}</AppText>;
}

/**
 * One conversation (Kanvas Academy's chat-thread). A customer sees their
 * chat with the MPE team; the team see any customer's (`conversationId`).
 * New messages arrive live (Supabase Realtime), with a poll every few
 * seconds in case one's missed. Photos come from the camera or the
 * library: a picture of the boiler, or the error code on its display.
 * Laid out as Kanvas Academy's: a customer types in one tidy row (the
 * message, "+" for a photo, send); the team get the message box full
 * width with a toolbar under it: send as Live chat, Text or Email, the
 * "+" (with `actions`, a sheet of what they can do for this customer, and
 * the photos), and Send.
 */
export function ChatThread({
  conversationId,
  header,
  onLoaded,
  actions,
  actionsTitle,
}: {
  conversationId?: string;
  header?: ReactNode;
  onLoaded?: (data: ConversationResponse) => void;
  actions?: SheetAction[];
  actionsTitle?: string;
}) {
  const [data, setData] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<Channel>("chat");
  const [viewing, setViewing] = useState<string | null>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const [plus, setPlus] = useState(false);
  const [channelMenu, setChannelMenu] = useState(false);
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN);
  const channelSetRef = useRef(false);
  const rootRef = useRef<View>(null);
  const latestRef = useRef<string | null>(null);
  const sentAnyRef = useRef(false);

  const query = conversationId ? `?conversationId=${conversationId}` : "";
  const id = data?.conversation.id ?? conversationId ?? null;
  const viewerId = data?.viewer.id ?? null;
  const staff = !!data?.viewer.staff && !!conversationId;

  const { refreshMe } = useAuth();
  const markRead = useCallback(() => {
    apiPost("/api/mobile/chat/read", conversationId ? { conversationId } : {})
      .then(() => refreshMe())
      .catch(() => {});
  }, [conversationId, refreshMe]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<ConversationResponse>(`/api/mobile/chat/conversation${query}`);
      setData(res);
      setMessages(res.messages);
      // Reply the way they last got in touch: a text gets a text back.
      if (!channelSetRef.current) {
        channelSetRef.current = true;
        const lastFromThem = [...res.messages].reverse().find((m) => !m.senderIsCoach);
        if (res.viewer.staff && conversationId && lastFromThem?.channel === "sms" && res.conversation.phone) setChannel("sms");
      }
      latestRef.current = res.messages.at(-1)?.createdAt ?? null;
      onLoaded?.(res);
      markRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the chat.");
    }
  }, [query, markRead, onLoaded]);

  const fetchNew = useCallback(async () => {
    if (!latestRef.current) return load();
    try {
      const sep = query ? "&" : "?";
      const res = await apiFetch<ConversationResponse>(`/api/mobile/chat/conversation${query}${sep}after=${encodeURIComponent(latestRef.current)}`);
      if (!res.messages.length) return;
      setMessages((current) => merge(current, res.messages, res.viewer.id));
      latestRef.current = res.messages.at(-1)!.createdAt;
      if (res.messages.some((m) => m.senderId !== res.viewer.id)) markRead();
    } catch {
      // The next poll tries again.
    }
  }, [load, query, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  // Live while the chat is on screen: Realtime, plus a poll in case it's missed.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const timer = setInterval(fetchNew, POLL_MS);
      const channelSub = supabase
        ?.channel(`chat_messages:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${id}` }, () => fetchNew())
        .subscribe();
      return () => {
        clearInterval(timer);
        if (channelSub) supabase?.removeChannel(channelSub);
      };
    }, [id, fetchNew]),
  );

  // The composer rides up with the keyboard (Kanvas Academy measures it the same way).
  useEffect(() => {
    const show = (e: KeyboardEvent) => {
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKeyboardPad(Math.max(0, y + h - e.endCoordinates.screenY)));
    };
    const hide = () => setKeyboardPad(0);
    const subs =
      Platform.OS === "ios"
        ? [Keyboard.addListener("keyboardWillChangeFrame", show), Keyboard.addListener("keyboardWillHide", hide)]
        : [Keyboard.addListener("keyboardDidShow", show), Keyboard.addListener("keyboardDidHide", hide)];
    return () => subs.forEach((s) => s.remove());
  }, []);

  async function send(body: string, photo?: { uri: string; mimeType?: string }) {
    if (!id || (!body.trim() && !photo)) return;
    const stand: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: id,
      senderId: viewerId,
      senderIsCoach: staff,
      body: body.trim(),
      channel,
      attachmentPath: null,
      attachmentType: photo ? "image" : null,
      attachmentName: null,
      createdAt: new Date().toISOString(),
      pending: true,
      localUri: photo?.uri,
    };
    setMessages((current) => [...current, stand]);
    setSending(true);
    try {
      const attachmentPath = photo ? await uploadChatPhoto(id, photo.uri, photo.mimeType) : undefined;
      await apiPost("/api/mobile/chat/send", {
        body: body.trim(),
        ...(conversationId ? { conversationId, channel } : {}),
        ...(attachmentPath ? { attachmentPath, attachmentType: "image", attachmentName: "Photo" } : {}),
      });
      haptic.success();
      await fetchNew();
      // A customer's first message: ask about notifications now it makes sense.
      if (!staff && !sentAnyRef.current) {
        sentAnyRef.current = true;
        registerForPush();
      }
    } catch (err) {
      haptic.warning();
      setMessages((current) => current.filter((m) => m.id !== stand.id));
      if (!photo) setDraft(body);
      Alert.alert("Not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function pick(from: "camera" | "library") {
    const permission = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(from === "camera" ? "Camera is off for MPE" : "Photos are off for MPE", "You can turn it on in Settings.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, exif: false };
    const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) send(draft.trim() ? draft : "", { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }).then(() => setDraft(""));
  }

  function attach() {
    if (Platform.OS === "web") return pick("library");
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: ["Take a photo", "Choose from photos", "Cancel"], cancelButtonIndex: 2 }, (i) => {
        if (i === 0) pick("camera");
        if (i === 1) pick("library");
      });
      return;
    }
    Alert.alert("Send a photo", undefined, [
      { text: "Take a photo", onPress: () => pick("camera") },
      { text: "Choose from photos", onPress: () => pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // Newest at the bottom: an inverted list, so it opens at the latest.
  const rows = useMemo(() => [...messages].reverse(), [messages]);

  if (error && !data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.text3} />
        <AppText weight="semibold" style={{ fontSize: 17, textAlign: "center" }}>
          Couldn&apos;t open the chat
        </AppText>
        <AppText style={{ color: colors.text2, textAlign: "center" }}>{error}</AppText>
        <PressableScale onPress={load} accessibilityLabel="Try again" style={{ marginTop: 6, height: 48, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.orangeDeep, justifyContent: "center" }}>
          <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>
            Try again
          </AppText>
        </PressableScale>
      </View>
    );
  }

  return (
    <View ref={rootRef} style={{ flex: 1, paddingBottom: keyboardPad }}>
      {!data ? (
        <View style={{ flex: 1, justifyContent: "flex-end", padding: 16, gap: 12 }}>
          <Skeleton width="62%" height={56} radius={18} />
          <Skeleton width="48%" height={44} radius={18} style={{ alignSelf: "flex-end" }} />
          <Skeleton width="70%" height={72} radius={18} />
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 16 }}
          ListFooterComponent={header ? <View style={{ marginBottom: 12 }}>{header}</View> : null}
          renderItem={({ item, index }) => {
            const older = rows[index + 1];
            const mine = item.senderId === viewerId;
            const showDivider = !older || new Date(item.createdAt).getTime() - new Date(older.createdAt).getTime() > GAP_FOR_DIVIDER_MS;
            const firstOfRun = showDivider || older.senderId !== item.senderId;
            // Who gets a face and a name: the team (or MPE's own messages) to a
            // customer, and a teammate to the team. The customer, to the team,
            // is just their bubbles: whose chat it is is at the top.
            const labelled = !mine && (item.senderIsCoach || item.senderId === null);
            const name = item.senderId === null ? "MPE" : item.senderName || "MPE";
            const photo = item.attachmentType === "image" ? (item.localUri ?? item.attachmentUrl ?? null) : null;
            const textColor = mine ? "#fff" : colors.navy;
            return (
              <View style={{ marginBottom: 4 }}>
                {showDivider && <AppText style={{ textAlign: "center", color: colors.text2, fontSize: 11, marginVertical: 10 }}>{dayTime(item.createdAt)}</AppText>}
                <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                  {labelled && (
                    <View style={{ width: 26, height: 26 }}>
                      {firstOfRun &&
                        (item.senderId === null ? (
                          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="flame" size={15} color="#fff" />
                          </View>
                        ) : (
                          <Avatar name={name} url={item.senderAvatarUrl} size={26} />
                        ))}
                    </View>
                  )}
                  <View style={{ maxWidth: "80%", gap: 2, opacity: item.pending ? 0.6 : 1 }}>
                    {labelled && firstOfRun && (
                      <AppText weight="medium" style={{ color: colors.text2, fontSize: 11, marginLeft: 4 }}>
                        {name}
                      </AppText>
                    )}
                    <View
                      style={{
                        borderRadius: 18,
                        padding: photo ? 6 : 0,
                        gap: 6,
                        backgroundColor: mine ? colors.orangeDeep : colors.grey,
                        borderWidth: mine ? 0 : 1,
                        borderColor: colors.edge,
                      }}
                    >
                      {photo && (
                        <Pressable onPress={() => setViewing(photo)} accessibilityLabel="Open photo" accessibilityRole="imagebutton" style={({ pressed }) => [{ width: 208, height: 208, borderRadius: 12, overflow: "hidden" }, pressed && { opacity: 0.85 }]}>
                          <Image source={{ uri: photo }} style={{ width: "100%", height: "100%", backgroundColor: colors.edge }} resizeMode="cover" accessibilityIgnoresInvertColors />
                          {item.pending && (
                            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" }}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}
                        </Pressable>
                      )}
                      {!!item.body && (
                        <View style={{ paddingHorizontal: photo ? 6 : 14, paddingVertical: photo ? 2 : 9 }}>
                          <MessageText body={item.body} color={textColor} />
                        </View>
                      )}
                    </View>
                    {staff && item.channel !== "chat" && (
                      <AppText style={{ color: colors.text2, fontSize: 11, marginHorizontal: 4, textAlign: mine ? "right" : "left" }}>via {item.channel === "sms" ? "text" : "email"}</AppText>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {staff ? (
        // The team's composer (Kanvas Academy's coach layout): the message
        // full width on top, growing to about five lines, and a toolbar
        // under it: send as, the "+", and Send.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.edge, backgroundColor: colors.page }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            onContentSizeChange={(e) => setInputHeight(Math.min(COMPOSER_MAX, Math.max(COMPOSER_MIN, e.nativeEvent.contentSize.height + 20)))}
            placeholder="Type a message…"
            placeholderTextColor={colors.text2}
            accessibilityLabel="Message"
            style={{ height: draft ? inputHeight : COMPOSER_MIN, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 17, lineHeight: 22, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
            {!data?.conversation.isTeam && (
              <View>
                <Pressable
                  onPress={() => setChannelMenu((v) => !v)}
                  accessibilityLabel={`Send as ${CHANNEL_LABEL[channel]}. Change it`}
                  style={({ pressed }) => [{ height: 44, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 }, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name={CHANNEL_ICON[channel]} size={16} color={colors.navy} />
                  <AppText weight="bold" style={{ fontSize: 15 }}>
                    {CHANNEL_LABEL[channel]}
                  </AppText>
                  <Ionicons name={channelMenu ? "chevron-up" : "chevron-down"} size={14} color={colors.navy} />
                </Pressable>
                {channelMenu && (
                  <View style={{ position: "absolute", bottom: 48, left: 0, width: 190, borderRadius: 14, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.page, paddingVertical: 4, zIndex: 10, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
                    {(["chat", ...(data?.conversation.phone ? (["sms"] as const) : []), "email"] as Channel[]).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => {
                          setChannel(c);
                          setChannelMenu(false);
                        }}
                        accessibilityLabel={`${CHANNEL_LABEL[c]}${channel === c ? ", selected" : ""}`}
                        style={({ pressed }) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }, pressed && { backgroundColor: colors.cream }]}
                      >
                        <Ionicons name={`${CHANNEL_ICON[c]}-outline` as never} size={16} color={channel === c ? colors.navy : colors.text2} />
                        <AppText weight={channel === c ? "bold" : "regular"} style={{ fontSize: 14, flex: 1 }}>
                          {CHANNEL_LABEL[c]}
                        </AppText>
                        {channel === c && <Ionicons name="checkmark" size={14} color={colors.navy} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                setChannelMenu(false);
                if (actions) setPlus(true);
                else attach();
              }}
              accessibilityLabel={actions ? "More: book, invoice, payment, quote, photo" : "Send a photo"}
              style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="add-circle-outline" size={28} color={colors.orangeDeep} />
            </Pressable>
            <Pressable
              onPress={() => {
                const body = draft;
                setDraft("");
                setChannelMenu(false);
                send(body);
              }}
              disabled={!draft.trim() || !data}
              accessibilityLabel="Send"
              style={({ pressed }) => [{ height: 44, justifyContent: "center" }, pressed && { opacity: 0.8 }]}
            >
              <View style={{ height: 40, borderRadius: 20, paddingHorizontal: 20, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center", opacity: !draft.trim() || !data ? 0.45 : 1 }}>
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <AppText weight="bold" style={{ color: "#fff", fontSize: 15 }}>
                    Send
                  </AppText>
                )}
              </View>
            </Pressable>
          </View>
        </View>
      ) : (
        // A customer's composer: one tidy row, the message, "+" for a photo, send.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.edge, backgroundColor: colors.page, flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            onContentSizeChange={(e) => setInputHeight(Math.min(COMPOSER_MAX, Math.max(COMPOSER_MIN, e.nativeEvent.contentSize.height + 20)))}
            placeholder="Type a message…"
            placeholderTextColor={colors.text2}
            accessibilityLabel="Message"
            style={{ flex: 1, height: draft ? inputHeight : COMPOSER_MIN, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.grey, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 16, lineHeight: 22, fontFamily: fonts.regular, color: colors.navy, textAlignVertical: "top" }}
          />
          <Pressable onPress={attach} accessibilityLabel="Send a photo" style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="add-circle-outline" size={28} color={colors.orangeDeep} />
          </Pressable>
          <Pressable
            onPress={() => {
              const body = draft;
              setDraft("");
              send(body);
            }}
            disabled={!draft.trim() || !data}
            accessibilityLabel="Send"
            style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.orangeDeep, opacity: !draft.trim() || !data ? 0.45 : 1 }, pressed && { opacity: 0.8 }]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
          </Pressable>
        </View>
      )}

      <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
      {actions && (
        <ActionSheet
          visible={plus}
          title={actionsTitle ?? "More"}
          actions={[
            ...actions,
            ...(Platform.OS === "web" ? [] : [{ key: "camera", label: "Take a photo", icon: "camera" as const, onPress: () => pick("camera") }]),
            { key: "library", label: "Send a photo", icon: "image" as const, onPress: () => pick("library") },
          ]}
          onClose={() => setPlus(false)}
        />
      )}
    </View>
  );
}
