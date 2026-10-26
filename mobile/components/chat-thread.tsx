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

function dayTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

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
  return <AppText style={{ color, fontSize: 16, lineHeight: 22 }}>{parts}</AppText>;
}

/**
 * One conversation (Kanvas Academy's chat-thread). A customer sees their
 * chat with the MPE team; the team see any customer's (`conversationId`).
 * New messages arrive live (Supabase Realtime), with a poll every few
 * seconds in case one's missed. Photos come from the camera or the
 * library: a picture of the boiler, or the error code on its display.
 * For the team, `actions` puts a "+" in the composer instead of the
 * camera: a sheet of what they can do for this customer, with the photos.
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
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
          ListFooterComponent={header ? <View style={{ marginBottom: 12 }}>{header}</View> : null}
          renderItem={({ item, index }) => {
            const older = rows[index + 1];
            const mine = item.senderId === viewerId || (staff && item.senderIsCoach && item.senderId === viewerId);
            const showDivider = !older || new Date(item.createdAt).getTime() - new Date(older.createdAt).getTime() > GAP_FOR_DIVIDER_MS;
            const firstOfRun = showDivider || older.senderId !== item.senderId;
            const fromTeam = item.senderIsCoach && !mine;
            const name = item.senderId === null ? "MPE" : item.senderName || (fromTeam ? "MPE" : (data?.conversation.title ?? "Customer"));
            const photo = item.attachmentType === "image" ? (item.localUri ?? item.attachmentUrl ?? null) : null;
            const textColor = mine ? "#fff" : colors.navy;
            return (
              <View>
                {showDivider && (
                  <AppText style={{ textAlign: "center", color: colors.text3, fontSize: 12, marginVertical: 10 }}>{dayTime(item.createdAt)}</AppText>
                )}
                <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, marginTop: firstOfRun ? 6 : 2 }}>
                  {!mine && (
                    <View style={{ width: 28 }}>
                      {firstOfRun &&
                        (item.senderId === null ? (
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orangeDeep, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="flame" size={16} color="#fff" />
                          </View>
                        ) : (
                          <Avatar name={name} url={item.senderAvatarUrl} size={28} />
                        ))}
                    </View>
                  )}
                  <View style={{ maxWidth: "78%", opacity: item.pending ? 0.6 : 1 }}>
                    {!mine && firstOfRun && (
                      <AppText weight="semibold" style={{ color: colors.text3, fontSize: 12, marginBottom: 3, marginLeft: 4 }}>
                        {name}
                      </AppText>
                    )}
                    <View
                      style={{
                        width: photo ? 240 : undefined,
                        borderRadius: 20,
                        overflow: "hidden",
                        backgroundColor: mine ? colors.orangeDeep : colors.card,
                        borderWidth: mine ? 0 : 1,
                        borderColor: colors.edge,
                        borderBottomRightRadius: mine ? 6 : 20,
                        borderBottomLeftRadius: mine ? 20 : 6,
                      }}
                    >
                      {photo && (
                        <Pressable onPress={() => setViewing(photo)} accessibilityLabel="Open photo" accessibilityRole="imagebutton">
                          <Image source={{ uri: photo }} style={{ width: "100%", height: 240, backgroundColor: colors.grey }} resizeMode="cover" accessibilityIgnoresInvertColors />
                          {item.pending && (
                            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" }}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}
                        </Pressable>
                      )}
                      {!!item.body && (
                        <View style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                          <MessageText body={item.body} color={textColor} />
                        </View>
                      )}
                    </View>
                    {staff && item.channel !== "chat" && (
                      <AppText style={{ color: colors.text3, fontSize: 11, marginTop: 2, textAlign: mine ? "right" : "left" }}>{item.channel === "sms" ? "Sent by text" : "Sent by email"}</AppText>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* The composer. */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.edge, backgroundColor: colors.page, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 }}>
        {staff && !data?.conversation.isTeam && (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }} accessibilityRole="radiogroup">
            {(["chat", "sms", "email"] as Channel[]).map((c) => (
              <PressableScale
                key={c}
                onPress={() => setChannel(c)}
                accessibilityLabel={c === "chat" ? "Send in the app and website chat" : c === "sms" ? "Also send as a text" : "Also send as an email"}
                style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: channel === c ? colors.navy : colors.grey }}
              >
                <AppText weight="semibold" style={{ fontSize: 13, color: channel === c ? "#fff" : colors.navy }}>
                  {c === "chat" ? "Chat" : c === "sms" ? "Text" : "Email"}
                </AppText>
              </PressableScale>
            ))}
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          {actions ? (
            <PressableScale onPress={() => setPlus(true)} accessibilityLabel="More: book, invoice, payment, quote, photo" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.orangeLight }}>
              <Ionicons name="add" size={26} color={colors.orangeDeep} />
            </PressableScale>
          ) : (
            <PressableScale onPress={attach} accessibilityLabel="Send a photo" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.grey }}>
              <Ionicons name="camera" size={22} color={colors.navy} />
            </PressableScale>
          )}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={staff ? "Reply…" : "Message the MPE team…"}
            placeholderTextColor={colors.text3}
            multiline
            accessibilityLabel="Message"
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: colors.edge, backgroundColor: colors.cream, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, fontFamily: fonts.regular, color: colors.navy }}
          />
          <PressableScale
            onPress={() => {
              const body = draft;
              setDraft("");
              send(body);
            }}
            disabled={!draft.trim() || !data}
            accessibilityLabel="Send"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.orangeDeep }}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
          </PressableScale>
        </View>
      </View>

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
