import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread } from "@/components/chat-thread";
import { Avatar } from "@/components/avatar";
import { AppText, PressableScale, haptic } from "@/components/ui";
import type { SheetAction } from "@/components/action-sheet";
import { apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { openExternal } from "@/lib/open-link";
import { colors } from "@/lib/theme";
import type { ConversationResponse } from "@/lib/types";

type Conversation = ConversationResponse["conversation"];

function statusLine(c: Conversation): string {
  if (c.completed) return "Marked done";
  if (c.customerId) return "Tap for their details";
  return c.guest ? "Website visitor · tap to add" : "Tap to add as a customer";
}

/**
 * One customer's conversation, for the team (Kanvas Academy's coach
 * thread). Their name at the top opens everything about them: details,
 * jobs underway, what they owe, notes (app/customer/[id].tsx). The "+" by
 * the message box books a visit, sends an invoice or call-out fee, takes
 * a payment, starts a quote, or sends a photo. Call and Done on the right.
 */
export default function TeamConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const onLoaded = useCallback((data: ConversationResponse) => setConversation((current) => ({ ...data.conversation, customerId: data.conversation.customerId ?? current?.customerId ?? null })), []);
  const first = conversation?.title.split(" ")[0] ?? "them";

  async function toggleDone() {
    if (!conversation) return;
    try {
      await apiPost("/api/mobile/chat/status", { conversationId: conversation.id, action: conversation.completed ? "reopen" : "complete" });
      haptic.success();
      if (conversation.completed) setConversation({ ...conversation, completed: false });
      else router.back();
    } catch (err) {
      notify("Couldn't change that", err instanceof Error ? err.message : "Please try again.");
    }
  }

  /** Their customer record: the one they have, or one made from the chat (once Fergal says so). */
  async function customerId(): Promise<string | null> {
    if (!conversation) return null;
    if (conversation.customerId) return conversation.customerId;
    const ok = await confirmAction(`Add ${conversation.title} as a customer?`, "Their name, email and number from this chat go on a customer record, so you can book them in, invoice and keep notes.", "Add them");
    if (!ok) return null;
    try {
      const res = await apiPost<{ id: string }>("/api/mobile/staff/customers/from-chat", { conversationId: conversation.id });
      setConversation({ ...conversation, customerId: res.id });
      haptic.success();
      return res.id;
    } catch (err) {
      notify("Couldn't add them", err instanceof Error ? err.message : "Please try again.");
      return null;
    }
  }

  const withCustomer = (go: (customer: string) => void) => async () => {
    const customer = await customerId();
    if (customer) go(customer);
  };

  const actions: SheetAction[] = [
    { key: "visit", label: "Book a visit", icon: "calendar", tone: "orange", onPress: withCustomer((c) => router.push(`/visit-form?customer=${c}&conversation=${conversation?.id ?? ""}`)) },
    { key: "invoice", label: "Invoice or call-out fee", icon: "receipt", onPress: withCustomer((c) => router.push(`/new-payment?customer=${c}`)) },
    { key: "pay", label: "Take payment", icon: "card", onPress: withCustomer((c) => router.push(`/customer/${c}?pay=1`)) },
    { key: "quote", label: "New quote", icon: "document-text", onPress: withCustomer((c) => router.push(`/new-quote?customer=${c}`)) },
    { key: "details", label: "Their details", icon: "person", onPress: withCustomer((c) => router.push(`/customer/${c}`)) },
  ];

  const openDetails = withCustomer((c) => router.push(`/customer/${c}`));
  const team = !!conversation?.isTeam;
  const nameBlock = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {team ? (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="people" size={20} color="#fff" />
        </View>
      ) : (
        <Avatar name={conversation?.title ?? "?"} url={null} size={38} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <AppText weight="bold" numberOfLines={1} accessibilityRole="header" style={{ fontSize: 17, flexShrink: 1 }}>
            {conversation?.title ?? "Chat"}
          </AppText>
          {!team && conversation && <Ionicons name="chevron-forward" size={15} color={colors.text3} />}
        </View>
        {conversation && !team && (
          <AppText style={{ color: conversation.completed ? colors.success : colors.text2, fontSize: 12 }} numberOfLines={1}>
            {statusLine(conversation)}
          </AppText>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
        <View style={{ height: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 4 }}>
          <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </PressableScale>
          {team || !conversation ? (
            <View style={{ flex: 1 }}>{nameBlock}</View>
          ) : (
            <PressableScale onPress={openDetails} accessibilityLabel={`${conversation.title}. ${conversation.customerId ? "Open their details" : "Add them as a customer"}`} style={{ flex: 1 }}>
              {nameBlock}
            </PressableScale>
          )}
          {conversation && !team && (
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
          )}
        </View>
      </View>
      <ChatThread conversationId={id} onLoaded={onLoaded} actions={team ? undefined : actions} actionsTitle={`For ${first}`} />
    </View>
  );
}
