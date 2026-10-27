import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread } from "@/components/chat-thread";
import { useBusinessCall } from "@/components/business-call";
import { Avatar } from "@/components/avatar";
import { AppText, haptic } from "@/components/ui";
import type { SheetAction } from "@/components/action-sheet";
import { apiPost } from "@/lib/api";
import { confirmAction, notify } from "@/lib/confirm";
import { colors } from "@/lib/theme";
import type { ConversationResponse } from "@/lib/types";

type Conversation = ConversationResponse["conversation"];

/** One line under their name: done, or how they last got in touch (Kanvas Academy's subtitle). */
function statusLine(c: Conversation): string {
  if (c.isTeam) return "The team chat";
  if (c.completed) return "Marked done";
  if (c.lastFrom === "app") return "Messaging from the app";
  if (c.lastFrom === "web") return "From the website chat";
  if (c.phoneOnly) return "Phoned or texted: no app or email";
  if (c.guest) return "Website visitor";
  return "Open conversation";
}

/** A round button in the header (call, done): Kanvas Academy's IconButton. */
function IconButton({ icon, label, onPress }: { icon: "call-outline" | "checkmark" | "arrow-undo-outline"; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      {({ pressed }) => (
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.grey, opacity: pressed ? 0.7 : 1 }}>
          <Ionicons name={icon} size={20} color={colors.navy} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * One customer's conversation, for the team (Kanvas Academy's coach
 * thread, laid out the same): back, their avatar and name with how they
 * last got in touch, then Call and Done as round buttons. Their name opens
 * everything about them: details, jobs underway, what they owe, notes
 * (app/customer/[id].tsx). The "+" in the composer's toolbar books a
 * visit, sends an invoice or call-out fee, takes a payment, starts a quote,
 * or sends a photo.
 */
export default function TeamConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const onLoaded = useCallback((data: ConversationResponse) => setConversation((current) => ({ ...data.conversation, customerId: data.conversation.customerId ?? current?.customerId ?? null })), []);
  const first = conversation?.title.split(" ")[0] ?? "them";
  const businessCall = useBusinessCall();

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
  async function customerId(then?: string): Promise<string | null> {
    if (!conversation) return null;
    if (conversation.customerId) return conversation.customerId;
    const ok = await confirmAction(`Add ${conversation.title} as a customer?`, "Their name, email and number from this chat go on a customer record, so you can book them in, invoice and keep notes.", "Add them");
    if (!ok) return null;
    try {
      const res = await apiPost<{ id: string; needsDetails?: boolean }>("/api/mobile/staff/customers/from-chat", { conversationId: conversation.id });
      setConversation({ ...conversation, customerId: res.id });
      haptic.success();
      // Only a number so far (they called or texted): their name, address, email
      // and how they found us first, then on to what he was doing.
      if (then && res.needsDetails) {
        router.push(`/customer-form?id=${res.id}&then=${then}&conversation=${conversation.id}` as never);
        return null;
      }
      return res.id;
    } catch (err) {
      notify("Couldn't add them", err instanceof Error ? err.message : "Please try again.");
      return null;
    }
  }

  const withCustomer = (go: (customer: string) => void, then?: string) => async () => {
    const customer = await customerId(then);
    if (customer) go(customer);
  };

  const actions: SheetAction[] = [
    { key: "visit", label: "Book a visit", icon: "calendar", tone: "orange", onPress: withCustomer((c) => router.push(`/visit-form?customer=${c}&conversation=${conversation?.id ?? ""}`), "visit") },
    { key: "invoice", label: "Invoice or call-out fee", icon: "receipt", onPress: withCustomer((c) => router.push(`/new-payment?customer=${c}`), "payment") },
    { key: "pay", label: "Take payment", icon: "card", onPress: withCustomer((c) => router.push(`/customer/${c}?pay=1`)) },
    { key: "quote", label: "New quote", icon: "document-text", onPress: withCustomer((c) => router.push(`/new-quote?customer=${c}`), "quote") },
    { key: "details", label: "Their details", icon: "person", onPress: withCustomer((c) => router.push(`/customer/${c}`)) },
  ];

  const openDetails = withCustomer((c) => router.push(`/customer/${c}`));
  const team = !!conversation?.isTeam;
  const identity = (
    <>
      {team ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="people" size={20} color="#fff" />
        </View>
      ) : (
        <Avatar name={conversation?.title ?? "?"} url={null} size={40} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="bold" numberOfLines={1} accessibilityRole="header" style={{ fontSize: 16 }}>
          {conversation?.title ?? "Chat"}
        </AppText>
        {conversation && (
          <AppText numberOfLines={1} style={{ color: colors.text2, fontSize: 12, marginTop: 1 }}>
            {statusLine(conversation)}
          </AppText>
        )}
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.edge }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4, paddingVertical: 6 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} accessibilityLabel="Back" style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>
          {team || !conversation ? (
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>{identity}</View>
          ) : (
            <Pressable
              onPress={openDetails}
              accessibilityLabel={`${conversation.title}. ${conversation.customerId ? "Open their details" : "Add them as a customer"}`}
              style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingRight: 6, borderRadius: 999 }, pressed && { backgroundColor: colors.cream }]}
            >
              {identity}
            </Pressable>
          )}
          {conversation && !team && (
            <>
              {conversation.phone && <IconButton icon="call-outline" label={`Call ${conversation.title}`} onPress={() => businessCall.call({ name: conversation.title, conversationId: conversation.id, directNumber: conversation.phone })} />}
              <IconButton icon={conversation.completed ? "arrow-undo-outline" : "checkmark"} label={conversation.completed ? "Reopen" : "Mark done"} onPress={toggleDone} />
            </>
          )}
        </View>
      </View>
      {businessCall.modal}
      <ChatThread conversationId={id} onLoaded={onLoaded} actions={team ? undefined : actions} actionsTitle={`For ${first}`} />
    </View>
  );
}
