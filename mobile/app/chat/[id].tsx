import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { ChatThread } from "@/components/chat-thread";
import { PressableScale, haptic } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { openExternal } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { ConversationResponse } from "@/lib/types";

/** One customer's conversation, for the team: reply (in chat, or by text or email too), call them, mark it done. */
export default function TeamConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationResponse["conversation"] | null>(null);
  const onLoaded = useCallback((data: ConversationResponse) => setConversation(data.conversation), []);

  async function toggleDone() {
    if (!conversation) return;
    try {
      await apiPost("/api/mobile/chat/status", { conversationId: conversation.id, action: conversation.completed ? "reopen" : "complete" });
      haptic.success();
      if (conversation.completed) setConversation({ ...conversation, completed: false });
      else router.back();
    } catch (err) {
      Alert.alert("Couldn't change that", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScreenHeader
        title={conversation?.title ?? "Chat"}
        right={
          conversation && !conversation.isTeam ? (
            <>
              {conversation.phone && (
                <PressableScale onPress={() => openExternal(`tel:${conversation.phone}`)} accessibilityLabel={`Call ${conversation.title}`} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call-outline" size={22} color={colors.navy} />
                </PressableScale>
              )}
              <PressableScale onPress={toggleDone} accessibilityLabel={conversation.completed ? "Reopen" : "Mark done"} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={conversation.completed ? "arrow-undo-outline" : "checkmark-done-outline"} size={24} color={colors.navy} />
              </PressableScale>
            </>
          ) : null
        }
      />
      <ChatThread conversationId={id} onLoaded={onLoaded} />
    </View>
  );
}
